import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AlertConnectionStatus,
  CommandAction,
  DeviceCommand,
} from "./useAlerts";
import { isDeviceCommand } from "./useAlerts";
import { isValidDeviceId } from "../config/deviceCommandTargets";

const COMMANDS_URL = "/api/v1/commands";
const MAX_TRACKED_COMMANDS = 100;
const COMMAND_STATUS_RANK: Record<DeviceCommand["status"], number> = {
  pending: 0,
  unconfirmed: 1,
  failed: 2,
  completed: 2,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function mergeCommand(
  current: DeviceCommand | undefined,
  incoming: DeviceCommand,
): DeviceCommand {
  if (!current) return incoming;
  const currentTime = Date.parse(current.updated_at);
  const incomingTime = Date.parse(incoming.updated_at);
  if (
    currentTime > incomingTime ||
    (currentTime === incomingTime &&
      COMMAND_STATUS_RANK[current.status] >=
        COMMAND_STATUS_RANK[incoming.status])
  ) {
    return current;
  }
  return incoming;
}

function upsertCommand(
  commands: Record<string, DeviceCommand>,
  incoming: DeviceCommand,
): Record<string, DeviceCommand> {
  const merged = mergeCommand(commands[incoming.command_id], incoming);
  if (merged === commands[incoming.command_id]) return commands;

  const next = { ...commands, [incoming.command_id]: merged };
  const terminalCommands = Object.values(next)
    .filter((command) => command.status !== "pending")
    .sort(
      (left, right) =>
        Date.parse(left.updated_at) - Date.parse(right.updated_at),
    );
  while (
    Object.keys(next).length > MAX_TRACKED_COMMANDS &&
    terminalCommands.length > 0
  ) {
    const oldest = terminalCommands.shift();
    if (oldest) delete next[oldest.command_id];
  }
  return next;
}

function errorMessage(status: number, payload: unknown): string {
  const error =
    isRecord(payload) && isRecord(payload.error) ? payload.error : undefined;
  if (error?.code === "mqtt_unavailable") {
    return "Le broker MQTT est indisponible ; la commande n’a pas été envoyée.";
  }
  if (error?.code === "validation_failed") {
    return "L’API a refusé la commande. Vérifiez l’identifiant configuré.";
  }
  return `L’API n’a pas accepté la commande (HTTP ${status}).`;
}

export function useDeviceCommands(
  realtimeCommands: Record<string, DeviceCommand>,
  connectionStatus: AlertConnectionStatus,
) {
  const [commands, setCommands] = useState<Record<string, DeviceCommand>>({});
  const [submittingActions, setSubmittingActions] = useState<
    Record<string, CommandAction>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const requestInFlight = useRef(new Set<string>());

  useEffect(() => {
    setCommands((current) => {
      let next = current;
      for (const [commandId, update] of Object.entries(realtimeCommands)) {
        if (update.command_id !== commandId) continue;
        next = upsertCommand(next, update);
      }
      return next;
    });
  }, [realtimeCommands]);

  useEffect(() => {
    if (connectionStatus !== "connected") return;
    const controller = new AbortController();
    const pendingCommands = Object.values(commands).filter(
      (command) => command.status === "pending",
    );

    async function refreshCommand(command: DeviceCommand) {
      try {
        const response = await fetch(
          `${COMMANDS_URL}/${encodeURIComponent(command.command_id)}`,
          { signal: controller.signal },
        );
        if (response.status === 404) {
          setCommands((current) => {
            const latest = current[command.command_id];
            if (!latest || latest.status !== "pending") return current;
            const unconfirmed: DeviceCommand = {
              ...latest,
              status: "unconfirmed",
              updated_at: new Date().toISOString(),
              error: "L’état de cette commande n’est plus disponible.",
            };
            return upsertCommand(current, unconfirmed);
          });
          return;
        }
        if (!response.ok) {
          throw new Error(`L’API a répondu avec le statut ${response.status}.`);
        }
        const payload: unknown = await response.json();
        if (
          !isRecord(payload) ||
          !isDeviceCommand(payload.data) ||
          payload.data.command_id !== command.command_id ||
          payload.data.device_id !== command.device_id ||
          payload.data.action !== command.action
        ) {
          throw new Error("L’API a renvoyé un état de commande invalide.");
        }
        const incomingCommand = payload.data;
        setStatusError(null);
        setCommands((current) => upsertCommand(current, incomingCommand));
      } catch (cause) {
        if (controller.signal.aborted) return;
        const message =
          cause instanceof Error ? cause.message : "Erreur inconnue.";
        setStatusError(
          `Impossible de rétablir l’état d’une commande : ${message}`,
        );
      }
    }

    for (const command of pendingCommands) void refreshCommand(command);
    return () => controller.abort();
  }, [commands, connectionStatus]);

  const sendCommand = useCallback(
    async (deviceId: string, action: CommandAction) => {
      if (requestInFlight.current.has(deviceId)) return;
      setError(null);
      if (!isValidDeviceId(deviceId)) {
        setError("L’identifiant de l’équipement est absent ou invalide.");
        return;
      }

      requestInFlight.current.add(deviceId);
      setSubmittingActions((current) => ({ ...current, [deviceId]: action }));
      try {
        const response = await fetch(COMMANDS_URL, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ device_id: deviceId, action }),
        });
        const payload: unknown = await response.json();
        if (!response.ok) {
          throw new Error(errorMessage(response.status, payload));
        }
        if (
          !isRecord(payload) ||
          !isDeviceCommand(payload.data) ||
          payload.data.device_id !== deviceId ||
          payload.data.action !== action
        ) {
          throw new Error("L’API a renvoyé une réponse de commande invalide.");
        }
        const incoming = payload.data;
        setCommands((current) => upsertCommand(current, incoming));
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Impossible d’envoyer la commande à l’API.",
        );
      } finally {
        requestInFlight.current.delete(deviceId);
        setSubmittingActions((current) => {
          const next = { ...current };
          delete next[deviceId];
          return next;
        });
      }
    },
    [],
  );

  const latestCommand = Object.values(commands).reduce<DeviceCommand | null>(
    (latest, command) =>
      !latest || Date.parse(command.updated_at) > Date.parse(latest.updated_at)
        ? command
        : latest,
    null,
  );
  return {
    commands,
    latestCommand,
    submittingActions,
    error,
    statusError,
    sendCommand,
  };
}
