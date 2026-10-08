import {
  Database,
  Eye,
  LayoutDashboard,
  Settings,
  ShieldAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const navigationLinkClassName =
  "h-auto w-full justify-start rounded-none px-4 py-3 text-neutral-400 hover:bg-transparent hover:text-white";

export default function DashboardSidebar() {
  return (
    <aside className="w-64 border-r border-neutral-800 bg-black flex flex-col">
      <div className="p-6 flex items-center gap-3">
        <div className="w-4 h-4 bg-emerald-500 rounded-sm" />
        <h1 className="text-white text-lg font-bold tracking-widest">
          AetherCorp
        </h1>
      </div>

      <nav className="flex-1 px-4 mt-6 space-y-2">
        <Button
          asChild
          variant="ghost"
          className={`${navigationLinkClassName} border-l-2 border-emerald-500 bg-neutral-900/80 text-white hover:bg-neutral-900/80 hover:text-white`}
        >
          <a href="#">
            <LayoutDashboard className="w-5 h-5 text-emerald-500" />
            <span className="text-sm font-medium">Vue Principale</span>
          </a>
        </Button>
        <Button asChild variant="ghost" className={navigationLinkClassName}>
          <a href="#">
            <Database className="w-5 h-5" />
            <span className="text-sm">Capteurs InfluxDB</span>
          </a>
        </Button>
        <Button asChild variant="ghost" className={navigationLinkClassName}>
          <a href="#">
            <Eye className="w-5 h-5" />
            <span className="text-sm">Vision IA</span>
          </a>
        </Button>
        <Button asChild variant="ghost" className={navigationLinkClassName}>
          <a href="#">
            <ShieldAlert className="w-5 h-5" />
            <span className="text-sm">Logs &amp; Sécurité</span>
          </a>
        </Button>
        <Button asChild variant="ghost" className={navigationLinkClassName}>
          <a href="#">
            <Settings className="w-5 h-5" />
            <span className="text-sm">Paramètres</span>
          </a>
        </Button>
      </nav>

      <div className="p-6 border-t border-neutral-800">
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <Badge
            variant="outline"
            className="h-2 w-2 rounded-full border-0 bg-emerald-500 p-0"
          />
          <span>En Ligne • AES256</span>
        </div>
      </div>
    </aside>
  );
}
