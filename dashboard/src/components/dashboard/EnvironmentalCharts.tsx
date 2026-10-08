import EnvironmentalChart from "./EnvironmentalChart";
import type { EnvironmentalAlert } from "./dashboardData";
import { getDashboardLabel } from "./measurementLabels";

interface EnvironmentalChartsProps {
  history: EnvironmentalAlert[];
  onPeriodChange: (range: "12h" | "24h" | "7d") => Promise<void>;
  loading: boolean;
  error: string | null;
}

function getUnit(measurement: string): string {
  if (measurement.endsWith("_c")) return "°C";
  if (measurement.endsWith("_pct")) return "%";
  if (measurement.endsWith("_raw")) return "brut";
  if (measurement.endsWith("_ppm")) return "ppm";
  if (measurement.endsWith("_v")) return "V";
  if (measurement.endsWith("_lux")) return "lux";
  return "";
}

export default function EnvironmentalCharts({
  history,
  onPeriodChange,
  loading,
  error,
}: EnvironmentalChartsProps) {
  const series = new Map<
    string,
    { points: { timestamp: string; value: number }[] }
  >();
  for (const alert of history) {
    for (const [name, value] of Object.entries(alert.measurements)) {
      if (typeof value !== "number") continue;
      const chart = series.get(name) ?? { points: [] };
      chart.points.push({ timestamp: alert.timestamp, value });
      series.set(name, chart);
    }
  }
  const measurements = [...series.entries()]
    .map(([name, chart]) => ({
      name,
      points: chart.points.sort(
        (first, second) =>
          Date.parse(first.timestamp) - Date.parse(second.timestamp),
      ),
    }))
    .sort((first, second) => first.name.localeCompare(second.name));

  return (
    <section className="w-[400px] min-w-[400px] overflow-y-auto bg-black">
      {measurements.length > 0 ? (
        <div className="divide-y divide-neutral-800">
          {measurements.map((measurement) => {
            return (
              <EnvironmentalChart
                key={measurement.name}
              title={getDashboardLabel(measurement.name)}
                unit={getUnit(measurement.name)}
                points={measurement.points}
                onPeriodChange={onPeriodChange}
              />
            );
          })}
        </div>
      ) : (
        <div
          className="p-6 text-sm text-neutral-500"
          role={error ? "alert" : "status"}
        >
          {loading
            ? "Chargement des mesures…"
            : error
              ? `Impossible de charger les mesures : ${error}`
              : history.length === 0
                ? "Aucune alerte disponible."
                : "Les alertes reçues ne contiennent pas de mesures."}
        </div>
      )}
    </section>
  );
}
