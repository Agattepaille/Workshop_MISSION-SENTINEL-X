import { useId, useMemo, useRef, useState } from "react";
import { Maximize2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  onPeriodChange: (range: TimeRange) => Promise<void>;
}

type TimeRange = "12h" | "24h" | "7d";

const numberFormat = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 2,
});

function formatTime(value: string | number): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
}

function formatDateTime(value: string | number): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString("fr-FR");
}

function formatDateTimeTick(value: string | number): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function ChartPlot({
  points,
  title,
  unit,
  heightClass,
  emptyMessage = "Aucune mesure reçue",
  showDateTimeTicks = false,
  timeDomain,
}: Omit<EnvironmentalChartProps, "onPeriodChange"> & {
  heightClass: string;
  emptyMessage?: string;
  showDateTimeTicks?: boolean;
  timeDomain?: readonly [number, number];
}) {
  const chartData = points.map((point) => ({
    ...point,
    timestamp: Date.parse(point.timestamp),
  }));
  const timeTicks = timeDomain
    ? [
        timeDomain[0],
        (timeDomain[0] + timeDomain[1]) / 2,
        timeDomain[1],
      ]
    : undefined;

  return (
    <div className={`${heightClass} w-full`}>
      {points.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
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
              type="number"
              scale="time"
              domain={timeDomain ?? ["dataMin", "dataMax"]}
              allowDataOverflow={timeDomain !== undefined}
              ticks={timeTicks}
              tickFormatter={showDateTimeTicks ? formatDateTimeTick : formatTime}
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
              labelFormatter={(label) => formatDateTime(Number(label))}
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
          {emptyMessage}
        </p>
      )}
    </div>
  );
}

export default function EnvironmentalChart({
  title,
  unit,
  points,
  onPeriodChange,
}: EnvironmentalChartProps) {
  const periodSelectId = useId();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>("12h");
  const [isLoadingRange, setIsLoadingRange] = useState(false);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const rangeRequestId = useRef(0);
  const drawerTimeDomain = useMemo(() => {
    const rangeInMilliseconds =
      timeRange === "12h"
        ? 12 * 60 * 60 * 1000
        : timeRange === "24h"
          ? 24 * 60 * 60 * 1000
          : 7 * 24 * 60 * 60 * 1000;
    const end = Date.now();
    return [end - rangeInMilliseconds, end] as const;
  }, [timeRange]);
  const drawerPoints = useMemo(() => {
    return points.filter((point) => {
      const timestamp = Date.parse(point.timestamp);
      return (
        Number.isFinite(timestamp) &&
        timestamp >= drawerTimeDomain[0] &&
        timestamp <= drawerTimeDomain[1]
      );
    });
  }, [drawerTimeDomain, points]);
  const values = points.map((point) => point.value);
  const minimum = values.length > 0 ? Math.min(...values) : 0;
  const maximum = values.length > 0 ? Math.max(...values) : 0;
  const latestValue = values.at(-1);
  const drawerValues = drawerPoints.map((point) => point.value);
  const drawerMinimum = drawerValues.length > 0 ? Math.min(...drawerValues) : 0;
  const drawerMaximum = drawerValues.length > 0 ? Math.max(...drawerValues) : 0;
  const drawerLatestValue = drawerValues.at(-1);

  async function handleTimeRangeChange(value: string) {
    if (value === "12h" || value === "24h" || value === "7d") {
      setTimeRange(value);
      setRangeError(null);
      setIsLoadingRange(true);
      const requestId = ++rangeRequestId.current;

      try {
        await onPeriodChange(value);
      } catch (cause) {
        if (requestId === rangeRequestId.current) {
          setRangeError(
            cause instanceof Error
              ? cause.message
              : "Impossible de charger cette période.",
          );
        }
      } finally {
        if (requestId === rangeRequestId.current) {
          setIsLoadingRange(false);
        }
      }
    }
  }

  function handleCardKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setIsDrawerOpen(true);
    }
  }

  return (
    <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
      <DrawerTrigger asChild>
        <Card
          className="cursor-pointer rounded-none border border-neutral-800 bg-neutral-900/50 p-4 ring-0 transition-colors hover:bg-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-400"
          role="button"
          tabIndex={0}
          aria-label={`${title}, ouvrir le graphique agrandi`}
          onKeyDown={handleCardKeyDown}
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            <span className="flex items-center gap-2 text-xs text-neutral-400">
              {latestValue !== undefined
                ? `${numberFormat.format(latestValue)} ${unit}`
                : unit}
              <Maximize2 aria-hidden="true" className="size-3.5" />
            </span>
          </div>
          <ChartPlot
            points={points}
            title={title}
            unit={unit}
            heightClass="h-36"
          />
          <div className="mt-2">
            <p className="text-xs text-neutral-500">
              {points.length > 0
                ? `${points.length} mesures • Min ${numberFormat.format(minimum)} ${unit} • Max ${numberFormat.format(maximum)} ${unit}`
                : "Les mesures apparaîtront ici."}
            </p>
          </div>
        </Card>
      </DrawerTrigger>

      <DrawerContent className="max-h-[90vh] border-neutral-700 bg-neutral-950 text-white">
        <DrawerHeader className="flex-row flex-wrap items-center justify-between gap-4 px-6 pb-3 pt-6 text-left">
          <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2">
            <div>
            <DrawerTitle className="text-lg font-semibold text-white">
              {title}
            </DrawerTitle>
            <DrawerDescription className="text-sm text-neutral-400">
              {drawerLatestValue !== undefined
                ? `Dernière mesure : ${numberFormat.format(drawerLatestValue)} ${unit}`
                : unit}
            </DrawerDescription>
            </div>
            <div className="flex items-center gap-3">
              <label
                htmlFor={periodSelectId}
                className="text-sm text-neutral-300"
              >
                Période
              </label>
              <Select value={timeRange} onValueChange={handleTimeRangeChange}>
                <SelectTrigger
                  id={periodSelectId}
                  className="w-48 border-neutral-700 bg-neutral-900 text-white"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12h">12 heures</SelectItem>
                  <SelectItem value="24h">24 heures</SelectItem>
                  <SelectItem value="7d">7 jours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DrawerClose asChild>
            <button
              type="button"
              aria-label="Fermer le graphique agrandi"
              className="rounded p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white focus-visible:outline-2 focus-visible:outline-blue-400"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </DrawerClose>
        </DrawerHeader>
        <div className="overflow-y-auto px-6 pb-6">
          <ChartPlot
            points={drawerPoints}
            title={title}
            unit={unit}
            heightClass="h-[min(55vh,480px)]"
            emptyMessage="Aucune mesure sur cette période."
            showDateTimeTicks
            timeDomain={drawerTimeDomain}
          />
          <p className="mt-3 text-xs text-neutral-500">
            {rangeError
              ? `Impossible de charger cette période : ${rangeError}`
              : isLoadingRange
                ? "Chargement de l’historique…"
                : drawerPoints.length > 0
                  ? `${drawerPoints.length} mesures • Min ${numberFormat.format(drawerMinimum)} ${unit} • Max ${numberFormat.format(drawerMaximum)} ${unit}`
                  : "Aucune mesure sur cette période."}
          </p>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
