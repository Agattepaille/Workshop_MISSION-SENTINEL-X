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

export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<AlertConnectionStatus>("connecting");

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let socket: WebSocket | undefined;
    let reconnectTimer: number | undefined;
    let reconnectDelay = 1000;
    let hasConnected = false;
    let snapshotRequest = 0;

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

        if (!isRecord(payload) || payload.type !== "alert.created") return;
        const incomingAlert = payload.data;
        if (!isAlert(incomingAlert)) {
          setError("Le serveur a envoyé une alerte WebSocket invalide.");
          return;
        }

        setAlerts((current) => mergeAlerts(current, [incomingAlert]));
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
    connect();

    return () => {
      active = false;
      controller.abort();
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      socket?.close(1000, "Dashboard unmounted");
    };
  }, []);

  return { alerts, loading, error, connectionStatus };
}
