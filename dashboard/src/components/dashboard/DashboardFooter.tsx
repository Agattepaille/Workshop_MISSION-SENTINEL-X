import type { Alert, AlertConnectionStatus } from "../../hooks/useAlerts";
import DashboardLogs from "./DashboardLogs";

interface DashboardFooterProps {
  alerts: Alert[];
  connectionStatus: AlertConnectionStatus;
  loading: boolean;
  error: string | null;
}

export default function DashboardFooter(props: DashboardFooterProps) {
  return (
    <footer className="h-24 border-t border-neutral-800 flex bg-black">
      <DashboardLogs {...props} />
    </footer>
  );
}
