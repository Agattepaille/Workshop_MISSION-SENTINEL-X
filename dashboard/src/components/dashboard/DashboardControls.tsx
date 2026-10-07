import { Button } from "@/components/ui/button";
import { isValidDeviceId } from "@/config/deviceCommandTargets";
import type {
  CommandAction,
  DeviceCommand,
  DeviceStatus,
} from "@/hooks/useAlerts";

interface DashboardControlsProps {
  deviceIds: Record<CommandAction, string>;
  deviceStatuses: Record<string, DeviceStatus>;
  commands: Record<string, DeviceCommand>;
  latestCommand: DeviceCommand | null;
  submittingActions: Record<string, CommandAction>;
  error: string | null;
  statusError: string | null;
  onSendCommand: (deviceId: string, action: CommandAction) => void;
}

const actionLabels: Record<CommandAction, string> = {
  "buzzer.trigger": "Activer Sirène",
  "leds.test": "Tester LEDs",
  "leds.auto": "Reprendre mode auto",
};

const commandStatusLabels: Record<DeviceCommand["status"], string> = {
  pending: "En attente de confirmation",
  completed: "Commande exécutée",
  failed: "Échec de la commande",
  unconfirmed: "Exécution non confirmée",
};

const controls: Array<{
  action: CommandAction;
  className: string;
}> = [
  {
    action: "buzzer.trigger",
    className:
      "bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.3)] hover:bg-red-500",
  },
  {
    action: "leds.test",
    className:
      "border-emerald-500/50 bg-transparent text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-400",
  },
  {
    action: "leds.auto",
    className:
      "border-neutral-600 bg-transparent text-neutral-300 hover:bg-neutral-800 hover:text-white",
  },
];

function latestActionCommand(
  commands: Record<string, DeviceCommand>,
  deviceId: string,
  action: CommandAction,
): DeviceCommand | undefined {
  return Object.values(commands)
    .filter(
      (command) => command.device_id === deviceId && command.action === action,
    )
    .sort(
      (left, right) =>
        Date.parse(right.updated_at) - Date.parse(left.updated_at),
    )[0];
}

function controlStatus(
  deviceId: string,
  status: DeviceStatus | undefined,
  command: DeviceCommand | undefined,
): string {
  if (!isValidDeviceId(deviceId))
    return "Identifiant non configuré ou invalide";
  const deviceMessage =
    status?.status === "offline"
      ? "Équipement hors ligne"
      : status?.mqtt_connected === false
        ? "Connexion MQTT indisponible"
        : status?.status === "online"
          ? "Équipement en ligne"
          : "État de l’équipement inconnu";
  if (!command) return deviceMessage;

  const commandMessage = command.error
    ? `${commandStatusLabels[command.status]} : ${command.error}`
    : commandStatusLabels[command.status];
  return `${deviceMessage} • ${commandMessage}`;
}

function latestCommandLabel(command: DeviceCommand | null): string {
  if (!command) return "Aucune commande envoyée.";
  return `${actionLabels[command.action]} • ${
    commandStatusLabels[command.status]
  } • ${command.device_id}`;
}

export default function DashboardControls({
  deviceIds,
  deviceStatuses,
  commands,
  latestCommand,
  submittingActions,
  error,
  statusError,
  onSendCommand,
}: DashboardControlsProps) {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-neutral-800 bg-black">
      <div className="flex h-24 shrink-0 items-center gap-4 border-b border-neutral-800 px-6">
        <img
          src="/logo.png"
          alt=""
          aria-hidden="true"
          className="h-14 w-14 shrink-0 object-contain"
        />
        <h1 className="text-lg font-bold tracking-widest text-white">
          AetherCorp
        </h1>
      </div>
      <div className="p-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-white">
          Panneau de contrôle
        </h2>
      </div>

      <div className="flex flex-col gap-4 p-4">
        {controls.map(({ action, className }) => {
          const deviceId = deviceIds[action];
          const status = isValidDeviceId(deviceId)
            ? deviceStatuses[deviceId]
            : undefined;
          const command = isValidDeviceId(deviceId)
            ? latestActionCommand(commands, deviceId, action)
            : undefined;
          const deviceBusy =
            Boolean(submittingActions[deviceId]) ||
            Object.values(commands).some(
              (item) =>
                item.device_id === deviceId && item.status === "pending",
            );
          const disabled =
            deviceBusy ||
            !isValidDeviceId(deviceId) ||
            status?.status === "offline" ||
            status?.mqtt_connected === false;
          const stateText = controlStatus(deviceId, status, command);

          return (
            <div key={action} className="flex flex-col gap-2">
              <Button
                type="button"
                variant={
                  action === "buzzer.trigger" ? "destructive" : "outline"
                }
                disabled={disabled}
                className={`h-auto w-full rounded px-4 py-3 text-sm font-bold ${className}`}
                aria-describedby={`command-state-${action}`}
                onClick={() => onSendCommand(deviceId, action)}
              >
                {submittingActions[deviceId] === action
                  ? "Envoi…"
                  : command?.status === "pending"
                    ? "En attente…"
                    : actionLabels[action]}
              </Button>
              <p
                id={`command-state-${action}`}
                className="break-words text-xs text-neutral-500"
                aria-live="polite"
              >
                {deviceId
                  ? `Équipement : ${deviceId} • ${stateText}`
                  : stateText}
              </p>
            </div>
          );
        })}
      </div>

      {(error || statusError) && (
        <div className="px-4" role="alert" aria-live="assertive">
          {error && <p className="text-sm text-red-400">{error}</p>}
          {statusError && (
            <p className="mt-2 text-sm text-amber-400">{statusError}</p>
          )}
        </div>
      )}

      <div className="mt-auto border-t border-neutral-800 p-6">
        <p className="text-xs text-neutral-500">Dernière commande</p>
        <p className="mt-2 break-words font-mono text-xs text-neutral-400">
          {latestCommandLabel(latestCommand)}
        </p>
      </div>
    </aside>
  );
}
