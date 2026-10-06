import { Button } from "@/components/ui/button";

export default function DashboardControls() {
  return (
    <div className="flex items-center px-6 gap-4 min-w-[400px]">
      <Button
        variant="destructive"
        className="h-auto rounded bg-red-600 px-6 py-2 text-sm font-bold text-white shadow-[0_0_15px_rgba(220,38,38,0.3)] hover:bg-red-500"
      >
        Activer Sirène
      </Button>
      <Button
        variant="outline"
        className="h-auto rounded border-emerald-500/50 bg-transparent px-6 py-2 text-sm font-bold text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-400"
      >
        Reset LEDs
      </Button>
      <span className="text-neutral-600 text-xs ml-4 font-mono">
        Dernière commande: Reset LEDs • 00:05:12
      </span>
    </div>
  );
}
