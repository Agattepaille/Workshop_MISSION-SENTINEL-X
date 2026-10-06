import { Button } from "@/components/ui/button";

export default function DashboardControls() {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-neutral-800 bg-black">
      <div className="flex h-24 shrink-0 items-center gap-4 border-b border-neutral-800 px-6">
        <img
          src="/logo.svg"
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
      <div className="flex flex-col gap-3 p-4">
        <Button
          variant="destructive"
          className="h-auto w-full rounded bg-red-600 px-4 py-3 text-sm font-bold text-white shadow-[0_0_15px_rgba(220,38,38,0.3)] hover:bg-red-500"
        >
          Activer Sirène
        </Button>
        <Button
          variant="outline"
          className="h-auto w-full rounded border-emerald-500/50 bg-transparent px-4 py-3 text-sm font-bold text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-400"
        >
          Reset LEDs
        </Button>
      </div>
      <div className="mt-auto border-t border-neutral-800 p-6">
        <p className="text-xs text-neutral-500">Dernière commande</p>
        <p className="mt-2 font-mono text-xs text-neutral-400">
          Reset LEDs • 00:05:12
        </p>
      </div>
    </aside>
  );
}
