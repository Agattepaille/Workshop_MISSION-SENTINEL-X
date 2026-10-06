import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

interface KpiCardProps {
  title: string;
  value: string;
  subtext: string;
  icon: LucideIcon;
  iconColor: string;
  alert?: boolean;
}

export default function KpiCard({
  title,
  value,
  subtext,
  icon: Icon,
  iconColor,
  alert = false,
}: KpiCardProps) {
  return (
    <Card
      className={`rounded-none border p-4 ring-0 ${alert ? "border-red-900/50" : "border-neutral-800"} flex flex-col justify-between bg-neutral-900/50`}
    >
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-neutral-400 text-xs uppercase tracking-wider font-semibold mb-1">
            {title}
          </h3>
          <p className={`text-xl font-bold ${alert ? "text-red-500" : "text-white"}`}>
            {value}
          </p>
        </div>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <p className="text-neutral-500 text-xs mt-3">{subtext}</p>
    </Card>
  );
}
