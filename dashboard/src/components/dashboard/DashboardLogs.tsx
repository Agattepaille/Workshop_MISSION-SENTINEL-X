import { Badge } from "@/components/ui/badge";
import type { AlertConnectionStatus } from "../../hooks/useAlerts";
import type { DashboardLogEntry } from "./dashboardData";
import { getDashboardLabel } from "./measurementLabels";

interface DashboardLogsProps {
  entries: DashboardLogEntry[];
  connectionStatus: AlertConnectionStatus;
  loading: boolean;
  error: string | null;
}

const CONNECTION_LABELS: Record<AlertConnectionStatus, string> = {
  connected: "Live",
  connecting: "Connexion",
  disconnected: "Hors ligne",
  reconnecting: "Reconnexion",
};

function formatAlert(alert: DashboardLogEntry): string {
  const timestamp = new Date(alert.timestamp).toLocaleTimeString("fr-FR");
  const details = [
    ...Object.entries(alert.measurements).map(
      ([name, value]) => `${getDashboardLabel(name)}=${value}`,
    ),
    ...Object.entries(alert.sensor_states).map(
      ([name, value]) => `${getDashboardLabel(name)}=${value}`,
    ),
  ].join(" · ");

  return `[${timestamp}] ${alert.device_id}${details ? ` • ${details}` : ""}`;
}

export default function DashboardLogs({
  entries,
  connectionStatus,
  loading,
  error,
}: DashboardLogsProps) {
  return (
    <div className="flex-1 p-4 font-mono text-[11px] overflow-hidden flex flex-col justify-center">
      <div className="flex justify-between text-neutral-500 mb-1">
        <span>Alertes API</span>
        <Badge
          variant="outline"
          className={`h-4 rounded px-1 text-[10px] ${
            connectionStatus === "connected"
              ? "border-emerald-500/50 text-emerald-400"
              : "border-amber-500/50 text-amber-400"
          }`}
          role="status"
        >
          {CONNECTION_LABELS[connectionStatus]}
        </Badge>
        <span>WebSocket /ws</span>
      </div>
      <div aria-live="polite" className="min-h-0 overflow-hidden">
        {error && (
          <p className="truncate text-red-400" role="alert" title={error}>
            {error}
          </p>
        )}
        {loading && entries.length === 0 ? (
          <p className="truncate text-neutral-500">Chargement des alertes…</p>
        ) : entries.length === 0 ? (
          <p className="truncate text-neutral-500">Aucune alerte reçue.</p>
        ) : (
          entries.slice(0, 2).map((alert) => (
            <p
              key={alert.id}
              className="truncate text-emerald-400/70"
              title={formatAlert(alert)}
            >
              {formatAlert(alert)}
            </p>
          ))
        )}
      </div>
    </div>
  );
}
