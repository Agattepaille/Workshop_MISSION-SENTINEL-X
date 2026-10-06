import { Card } from "@/components/ui/card";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface MeasurementPoint {
  timestamp: string;
  value: number;
}

interface EnvironmentalChartProps {
  title: string;
  unit: string;
  points: MeasurementPoint[];
}

const numberFormat = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 2,
});

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("fr-FR");
}

export default function EnvironmentalChart({
  title,
  unit,
  points,
}: EnvironmentalChartProps) {
  const values = points.map((point) => point.value);
  const minimum = values.length > 0 ? Math.min(...values) : 0;
  const maximum = values.length > 0 ? Math.max(...values) : 0;
  const latestValue = values.at(-1);

  return (
    <Card className="rounded-none border border-neutral-800 bg-neutral-900/50 p-4 ring-0">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-white text-sm font-semibold">{title}</h3>
        <span className="text-neutral-400 text-xs">
          {latestValue !== undefined
            ? `${numberFormat.format(latestValue)} ${unit}`
            : unit}
        </span>
      </div>
      <div className="h-36 w-full">
        {points.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={points}
              margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              accessibilityLayer
            >
              <CartesianGrid
                stroke="#262626"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatTime}
                tick={{ fill: "#737373", fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: "#404040" }}
                minTickGap={24}
              />
              <YAxis
                width={52}
                tickFormatter={(value: number) => numberFormat.format(value)}
                tick={{ fill: "#737373", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                domain={["auto", "auto"]}
              />
              <Tooltip
                labelFormatter={(label) => formatDateTime(String(label))}
                formatter={(value) => [
                  `${numberFormat.format(Number(value))} ${unit}`,
                  title,
                ]}
                contentStyle={{
                  backgroundColor: "#171717",
                  border: "1px solid #404040",
                  borderRadius: 0,
                }}
                labelStyle={{ color: "#a3a3a3" }}
                itemStyle={{ color: "#60a5fa" }}
              />
              <Line
                type="monotone"
                dataKey="value"
                name={title}
                stroke="#3b82f6"
                strokeWidth={2}
                dot={points.length === 1 ? { r: 3, fill: "#60a5fa" } : false}
                activeDot={{ r: 4, fill: "#60a5fa" }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
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
