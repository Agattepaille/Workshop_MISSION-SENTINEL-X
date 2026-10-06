import { Badge } from "@/components/ui/badge";

export default function DashboardLogs() {
  return (
    <div className="flex-1 p-4 font-mono text-[11px] overflow-hidden flex flex-col justify-center">
      <div className="flex justify-between text-neutral-500 mb-1">
        <span>MQTTS Logs</span>
        <Badge variant="outline" className="h-4 rounded px-1 text-[10px]">
          live
        </Badge>
        <span>stream://sentinelx.local:8883</span>
      </div>
      <div className="text-emerald-400/70 truncate">
        [11:24:09] INFO aether/telemetry temp=24.6C hum=55% • ok
      </div>
      <div className="text-amber-400/80 truncate">
        [11:24:10] WARN aether/gas/mq2 - spike detected: 210ppm
      </div>
      <div className="text-red-400 truncate">
        [11:24:12] ALERT vision/intrusion id=YOLOv8 conf=0.92 bbox=160,90,220,160
      </div>
    </div>
  );
}
