import { Card } from "@/components/ui/card";

interface EnvironmentalChartProps {
  title: string;
  dataSubtitle: string;
  footerText: string;
}

export default function EnvironmentalChart({
  title,
  dataSubtitle,
  footerText,
}: EnvironmentalChartProps) {
  return (
    <Card className="rounded-none border border-neutral-800 bg-neutral-900/50 p-4 ring-0">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-white text-sm font-semibold">{title}</h3>
        <span className="text-neutral-500 text-xs">{dataSubtitle}</span>
      </div>
      <div className="flex-1 relative w-full h-32 border-b border-l border-neutral-700">
        <svg
          viewBox="0 0 100 50"
          className="absolute w-full h-full preserve-3d"
          preserveAspectRatio="none"
        >
          <polyline
            fill="none"
            stroke="#3b82f6"
            strokeWidth="1.5"
            points="0,10 10,20 20,10 30,25 40,15 50,30 60,25 70,35 80,45 90,40 100,50"
          />
        </svg>
      </div>
      <div className="mt-2">
        <p className="text-neutral-500 text-xs">{footerText}</p>
      </div>
    </Card>
  );
}
