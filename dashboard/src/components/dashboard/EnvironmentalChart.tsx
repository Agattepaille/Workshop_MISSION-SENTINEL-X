import { Card } from "@/components/ui/card";

export interface MeasurementPoint {
  timestamp: string;
  value: number;
}

interface EnvironmentalChartProps {
  title: string;
  unit: string;
  points: MeasurementPoint[];
}

export default function EnvironmentalChart({
  title,
  unit,
  points,
}: EnvironmentalChartProps) {
  const values = points.map((point) => point.value);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const valueRange = maximum - minimum || 1;
  const coordinates = points.map((point, index) => ({
    x: points.length === 1 ? 50 : (index / (points.length - 1)) * 100,
    y: 45 - ((point.value - minimum) / valueRange) * 35,
  }));
  const polylinePoints = coordinates.map(({ x, y }) => `${x},${y}`).join(" ");
  const latestPoint = coordinates.at(-1);
  const numberFormat = new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 2,
  });

  return (
    <Card className="rounded-none border border-neutral-800 bg-neutral-900/50 p-4 ring-0">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-white text-sm font-semibold">{title}</h3>
        <span className="text-neutral-400 text-xs">
          {points.length > 0
            ? `${numberFormat.format(points.at(-1)!.value)} ${unit}`
            : unit}
        </span>
      </div>
      <div className="relative h-32 w-full border-b border-l border-neutral-700">
        {points.length > 0 ? (
          <svg
            viewBox="0 0 100 50"
            className="absolute h-full w-full"
            preserveAspectRatio="none"
            role="img"
            aria-label={`Historique de ${title}`}
          >
            <polyline
              fill="none"
              stroke="#3b82f6"
              strokeWidth="1.5"
              points={polylinePoints}
            />
            {latestPoint && (
              <circle
                cx={latestPoint.x}
                cy={latestPoint.y}
                r="2"
                fill="#60a5fa"
              />
            )}
          </svg>
        ) : (
          <p className="flex h-full items-center justify-center text-xs text-neutral-500">
            Aucune mesure reçue
          </p>
        )}
      </div>
      <div className="mt-2">
        <p className="text-neutral-500 text-xs">
          {points.length > 0
            ? `${points.length} mesures • Min ${numberFormat.format(minimum)} ${unit} • Max ${numberFormat.format(maximum)} ${unit}`
            : "Les mesures apparaîtront ici."}
        </p>
      </div>
    </Card>
  );
}
