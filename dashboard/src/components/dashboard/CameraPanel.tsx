import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export default function CameraPanel() {
  return (
    <section className="flex-1 border-r border-neutral-800 p-6 flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-white text-sm font-semibold">
          Caméra USB - Zone 3 (Entrée Est)
        </h2>
        <span className="text-neutral-500 text-xs tracking-wider">
          Flux RTSP • 1280x720 • 15fps
        </span>
      </div>

      <Card className="relative flex-1 rounded-none border border-neutral-800 bg-neutral-900 p-0 ring-0">
        <img
          src="/api/placeholder/800/400"
          alt="Flux caméra"
          className="w-full h-full object-cover opacity-60 grayscale"
        />
        <div className="absolute top-1/4 left-1/3 w-32 h-64 border-2 border-red-500/80 bg-red-500/10 flex items-start">
          <Badge variant="destructive" className="rounded-none px-1 py-0.5 font-mono text-[10px]">
            Intrus - YOLOv8 • 92%
          </Badge>
        </div>
        <div className="absolute bottom-4 left-4 flex gap-3 text-[10px] font-mono text-emerald-400">
          <Badge variant="destructive" className="h-4 rounded px-1 text-[10px]">
            REC
          </Badge>
          <span>HDR</span>
          <span>48ms</span>
        </div>
      </Card>

      <div className="flex justify-between items-center mt-3 text-xs text-neutral-500 font-mono">
        <span>Source: /dev/video0 • USB • ID: CAM-ENT-03</span>
        <span>AI: YOLOv8 • Conf: 92%</span>
      </div>
    </section>
  );
}
