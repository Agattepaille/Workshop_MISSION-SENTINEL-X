import EnvironmentalChart from "./EnvironmentalChart";
import type { EnvironmentalAlert } from "./dashboardData";

interface EnvironmentalChartsProps {
  history: EnvironmentalAlert[];
  loading: boolean;
  error: string | null;
}

const KNOWN_LABELS: Record<string, string> = {
  battery_v: "Tension batterie",
  gas_ppm: "Gaz",
  humidity_pct: "Humidité",
  light_lux: "Luminosité",
  soil_moisture_pct: "Humidité du sol",
  temperature_c: "Température",
};

function getUnit(measurement: string): string {
  if (measurement.endsWith("_c")) return "°C";
  if (measurement.endsWith("_pct")) return "%";
  if (measurement.endsWith("_ppm")) return "ppm";
  if (measurement.endsWith("_v")) return "V";
  if (measurement.endsWith("_lux")) return "lux";
  return "";
}

function getLabel(measurement: string): string {
  return (
    KNOWN_LABELS[measurement] ??
    measurement
      .replaceAll("_", " ")
      .replace(/\b\w/g, (character) => character.toUpperCase())
  );
}

export default function EnvironmentalCharts({
  history,
  loading,
  error,
}: EnvironmentalChartsProps) {
  const measurements = [
    ...new Set(history.flatMap((alert) => Object.keys(alert.measurements))),
  ].sort();

  return (
    <section className="w-[400px] min-w-[400px] overflow-y-auto bg-black">
      {measurements.length > 0 ? (
        <div className="divide-y divide-neutral-800">
          {measurements.map((measurement) => {
            const points = [...history].reverse().flatMap((alert) => {
              const value = alert.measurements[measurement];
              return typeof value === "number"
                ? [{ timestamp: alert.timestamp, value }]
                : [];
            });

            return (
              <EnvironmentalChart
                key={measurement}
                title={getLabel(measurement)}
                unit={getUnit(measurement)}
                points={points}
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
