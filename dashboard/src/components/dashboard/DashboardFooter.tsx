import DashboardControls from "./DashboardControls";
import DashboardLogs from "./DashboardLogs";
import { Separator } from "@/components/ui/separator";

export default function DashboardFooter() {
  return (
    <footer className="h-24 border-t border-neutral-800 flex bg-black">
      <DashboardControls />
      <Separator orientation="vertical" className="h-10 bg-neutral-800" />
      <DashboardLogs />
    </footer>
  );
}
