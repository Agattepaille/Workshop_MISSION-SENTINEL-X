import { useEffect, useState } from "react";

const ALERTS_URL = "/api/v1/alerts?limit=50";
const MAX_ALERTS = 50;

export interface Alert {
  id: string;
  timestamp: string;
  device_id: string;
  measurements: Record<string, number>;
  sensor_states: Record<string, string | boolean>;
  received_at: string;
}

export type AlertConnectionStatus =
  "connecting" | "connected" | "reconnecting" | "disconnected";

export type CommandAction = "buzzer.trigger" | "leds.test" | "leds.auto";
export type DeviceCommandStatus =
  "pending" | "completed" | "failed" | "unconfirmed";

export interface DeviceCommand {
  command_id: string;
  device_id: string;
  action: CommandAction;
  status: DeviceCommandStatus;
  created_at: string;
  updated_at: string;
  error?: string;
}

export interface DeviceStatus {
  device_id: string;
  status: "online" | "offline" | "unknown";
  received_at: string | null;
  mqtt_connected: boolean | null;
}

function isDeviceStatus(value: unknown): value is DeviceStatus["status"] {
  return value === "online" || value === "offline" || value === "unknown";
}

interface AlertsResponse {
  data: Alert[];
  pagination: {
    next_cursor: string | null;
    has_more: boolean;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isAlert(value: unknown): value is Alert {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.timestamp !== "string" ||
    typeof value.device_id !== "string" ||
    typeof value.received_at !== "string" ||
    !isRecord(value.measurements) ||
    !isRecord(value.sensor_states)
  ) {
    return false;
  }

  return (
    Number.isFinite(Date.parse(value.timestamp)) &&
    Number.isFinite(Date.parse(value.received_at)) &&
    Object.values(value.measurements).every(
      (measurement) =>
        typeof measurement === "number" && Number.isFinite(measurement),
    ) &&
    Object.values(value.sensor_states).every(
      (state) => typeof state === "boolean" || typeof state === "string",
    )
  );
}

function parseAlertsResponse(value: unknown): AlertsResponse {
  if (
    !isRecord(value) ||
    !Array.isArray(value.data) ||
    !value.data.every(isAlert) ||
    !isRecord(value.pagination) ||
    typeof value.pagination.has_more !== "boolean" ||
    !(
      value.pagination.next_cursor === null ||
      typeof value.pagination.next_cursor === "string"
    )
  ) {
    throw new Error(
      "La réponse de l’API ne contient pas une liste d’alertes valide.",
    );
  }

  return {
    data: value.data,
    pagination: {
      next_cursor: value.pagination.next_cursor,
      has_more: value.pagination.has_more,
    },
  };
}

export function isDeviceCommand(value: unknown): value is DeviceCommand {
  return (
    isRecord(value) &&
    typeof value.command_id === "string" &&
    typeof value.device_id === "string" &&
    (value.action === "buzzer.trigger" ||
      value.action === "leds.test" ||
      value.action === "leds.auto") &&
    (value.status === "pending" ||
      value.status === "completed" ||
      value.status === "failed" ||
      value.status === "unconfirmed") &&
    typeof value.created_at === "string" &&
    Number.isFinite(Date.parse(value.created_at)) &&
    typeof value.updated_at === "string" &&
    Number.isFinite(Date.parse(value.updated_at)) &&
    (value.error === undefined || typeof value.error === "string")
  );
}

function parseDeviceStatusResponse(value: unknown): DeviceStatus {
  if (
    !isRecord(value) ||
    !isRecord(value.data) ||
    typeof value.data.device_id !== "string" ||
    !isDeviceStatus(value.data.status) ||
    !(
      value.data.received_at === null ||
      (typeof value.data.received_at === "string" &&
        Number.isFinite(Date.parse(value.data.received_at)))
    ) ||
    typeof value.data.mqtt_connected !== "boolean"
  ) {
    throw new Error("L’API a renvoyé un état appareil invalide.");
  }

  return {
    device_id: value.data.device_id,
    status: value.data.status,
    received_at: value.data.received_at,
    mqtt_connected: value.data.mqtt_connected,
  };
}

function mergeAlerts(current: Alert[], incoming: Alert[]): Alert[] {
  const alertsById = new Map(current.map((alert) => [alert.id, alert]));
  for (const alert of incoming) alertsById.set(alert.id, alert);

  return [...alertsById.values()]
    .sort(
      (left, right) =>
        Date.parse(right.timestamp) - Date.parse(left.timestamp) ||
        right.id.localeCompare(left.id),
    )
    .slice(0, MAX_ALERTS);
}

function mergeDeviceStatuses(
  current: Record<string, DeviceStatus>,
  incoming: DeviceStatus[],
): Record<string, DeviceStatus> {
  let next = current;
  for (const status of incoming) {
    const existing = next[status.device_id];
    if (
      existing?.received_at &&
      status.received_at &&
      Date.parse(existing.received_at) >= Date.parse(status.received_at)
    ) {
      continue;
    }
    if (next === current) next = { ...current };
    next[status.device_id] = status;
  }
  return next;
}

function mergeCommandUpdate(
  current: Record<string, DeviceCommand>,
  incoming: DeviceCommand,
): Record<string, DeviceCommand> {
  const existing = current[incoming.command_id];
  if (
    existing &&
    Date.parse(existing.updated_at) > Date.parse(incoming.updated_at)
  ) {
    return current;
  }
  const next = { ...current, [incoming.command_id]: incoming };
  const terminalCommands = Object.values(next)
    .filter((command) => command.status !== "pending")
    .sort(
      (left, right) =>
        Date.parse(left.updated_at) - Date.parse(right.updated_at),
    );
  while (Object.keys(next).length > MAX_ALERTS && terminalCommands.length > 0) {
    const oldest = terminalCommands.shift();
    if (oldest) delete next[oldest.command_id];
  }
  return next;
}

export function useAlerts(deviceIds: string[] = []) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deviceStatuses, setDeviceStatuses] = useState<
    Record<string, DeviceStatus>
  >({});
  const [deviceStatusError, setDeviceStatusError] = useState<string | null>(
    null,
  );
  const [commandUpdates, setCommandUpdates] = useState<
    Record<string, DeviceCommand>
  >({});
  const [connectionStatus, setConnectionStatus] =
    useState<AlertConnectionStatus>("connecting");
  const deviceIdsKey = [...new Set(deviceIds)].join("\u0000");

  useEffect(() => {
    const controller = new AbortController();
    const configuredDeviceIds = deviceIdsKey
      ? deviceIdsKey.split("\u0000")
      : [];
    let active = true;
    let socket: WebSocket | undefined;
    let reconnectTimer: number | undefined;
    let reconnectDelay = 1000;
    let hasConnected = false;
    let snapshotRequest = 0;
    let deviceStatusRequest = 0;

    async function loadAlerts(initial = false) {
      const requestId = ++snapshotRequest;
      if (initial) setLoading(true);

      try {
        const response = await fetch(ALERTS_URL, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`L’API a répondu avec le statut ${response.status}.`);
        }

        const payload: unknown = await response.json();
        const result = parseAlertsResponse(payload);
        if (!active || requestId !== snapshotRequest) return;

        setAlerts((current) => mergeAlerts(current, result.data));
        setError(null);
      } catch (cause) {
        if (!active || controller.signal.aborted) return;
        if (requestId === snapshotRequest) {
          const message =
            cause instanceof Error ? cause.message : "Erreur inconnue.";
          setError(`Impossible de charger les alertes : ${message}`);
        }
      } finally {
        if (initial && active) setLoading(false);
      }
    }

    async function loadDeviceStatuses() {
      if (configuredDeviceIds.length === 0) {
        setDeviceStatusError(null);
        return;
      }
      const requestId = ++deviceStatusRequest;

      try {
        const statuses = await Promise.all(
          configuredDeviceIds.map(async (deviceId) => {
            const response = await fetch(
              `/api/v1/devices/${encodeURIComponent(deviceId)}/status`,
              { signal: controller.signal },
            );
            if (!response.ok) {
              throw new Error(
                `L’API a répondu avec le statut ${response.status}.`,
              );
            }
            return parseDeviceStatusResponse(await response.json());
          }),
        );

        if (!active || requestId !== deviceStatusRequest) return;
        setDeviceStatuses((current) => mergeDeviceStatuses(current, statuses));
        setDeviceStatusError(null);
      } catch (cause) {
        if (!active || controller.signal.aborted) return;
        if (requestId === deviceStatusRequest) {
          const message =
            cause instanceof Error ? cause.message : "Erreur inconnue.";
          setDeviceStatusError(
            `Impossible de charger l’état des équipements : ${message}`,
          );
        }
      }
    }

    function connect() {
      if (!active) return;
      setConnectionStatus(hasConnected ? "reconnecting" : "connecting");

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const nextSocket = new WebSocket(
        `${protocol}//${window.location.host}/ws`,
      );
      socket = nextSocket;

      nextSocket.onopen = () => {
        hasConnected = true;
        reconnectDelay = 1000;
        setConnectionStatus("connected");
        void loadAlerts();
        void loadDeviceStatuses();
      };

      nextSocket.onmessage = (message) => {
        if (typeof message.data !== "string") {
          setError("Le serveur a envoyé un message WebSocket illisible.");
          return;
        }

        let payload: unknown;
        try {
          payload = JSON.parse(message.data);
        } catch {
          setError("Le serveur a envoyé un message WebSocket invalide.");
          return;
        }

        if (!isRecord(payload)) {
          setError("Le serveur a envoyé un événement WebSocket invalide.");
          return;
        }

        if (payload.type === "alert.created") {
          if (!isAlert(payload.data)) {
            setError("Le serveur a envoyé une alerte WebSocket invalide.");
            return;
          }
          const incomingAlert = payload.data;
          setAlerts((current) => mergeAlerts(current, [incomingAlert]));
          return;
        }

        if (payload.type === "command.updated") {
          if (!isDeviceCommand(payload.data)) {
            setError("Le serveur a envoyé un état de commande invalide.");
            return;
          }
          const incomingCommand = payload.data;
          if (!configuredDeviceIds.includes(incomingCommand.device_id)) return;
          setCommandUpdates((current) =>
            mergeCommandUpdate(current, incomingCommand),
          );
          return;
        }

        if (payload.type === "device.status") {
          const status = payload.data;
          if (!isRecord(status) || typeof status.deviceId !== "string") {
            setDeviceStatusError(
              "Le serveur a envoyé un état d’équipement invalide.",
            );
            return;
          }
          if (!configuredDeviceIds.includes(status.deviceId)) return;
          if (
            typeof status.online !== "boolean" ||
            typeof status.received_at !== "string" ||
            !Number.isFinite(Date.parse(status.received_at))
          ) {
            setDeviceStatusError(
              "Le serveur a envoyé un état d’équipement invalide.",
            );
            return;
          }
          const deviceId = status.deviceId;
          const online = status.online;
          const receivedAt = status.received_at;
          setDeviceStatuses((current) => ({
            ...current,
            [deviceId]: {
              device_id: deviceId,
              status: online ? "online" : "offline",
              received_at: receivedAt,
              mqtt_connected: true,
            },
          }));
          setDeviceStatusError(null);
        }
      };

      nextSocket.onerror = () => {
        nextSocket.close();
      };

      nextSocket.onclose = () => {
        if (!active) return;
        setConnectionStatus(hasConnected ? "reconnecting" : "disconnected");
        reconnectTimer = window.setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, 30_000);
      };
    }

    void loadAlerts(true);
    void loadDeviceStatuses();
    connect();

    return () => {
      active = false;
      controller.abort();
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      socket?.close(1000, "Dashboard unmounted");
    };
  }, [deviceIdsKey]);

  return {
    alerts,
    loading,
    error,
    connectionStatus,
    deviceStatuses,
    deviceStatusError,
    commandUpdates,
  };
}
