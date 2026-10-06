import type { ReactElement } from "react";
import { AlertTriangle, Thermometer, Wind } from "lucide-react";
import CameraPanel from "./dashboard/CameraPanel";
import DashboardControls from "./dashboard/DashboardControls";
import DashboardFooter from "./dashboard/DashboardFooter";
import EnvironmentalCharts from "./dashboard/EnvironmentalCharts";
import KpiCard from "./dashboard/KpiCard";
import { useAlerts } from "../hooks/useAlerts";

const numberFormat = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 2,
});

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("fr-FR");
}

export default function SentinelDashboard(): ReactElement {
  const { alerts, loading, error, connectionStatus } = useAlerts();
  const latestAlert = alerts[0];
  const measurements = latestAlert?.measurements;
  const environmentReadings = [
    typeof measurements?.temperature_c === "number"
      ? `${numberFormat.format(measurements.temperature_c)} °C`
      : null,
    typeof measurements?.humidity_pct === "number"
      ? `${numberFormat.format(measurements.humidity_pct)} %`
      : null,
  ].filter((reading): reading is string => reading !== null);
  const noDataValue = loading
    ? "Chargement…"
    : error
      ? "Indisponible"
      : "Aucune donnée";

  return (
    <div className="dark min-h-screen bg-black text-neutral-300 font-sans flex">
      <DashboardControls />

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <section className="grid grid-cols-3 border-b border-neutral-800">
          <KpiCard
            title="Température DHT22"
            value={
              environmentReadings.length > 0
                ? environmentReadings.join(" / ")
                : latestAlert
                  ? "Non transmise"
                  : noDataValue
            }
            subtext={
              latestAlert
                ? `Dernière lecture : ${formatDateTime(latestAlert.received_at)}`
                : "En attente d’une alerte."
            }
            icon={Thermometer}
            iconColor="text-cyan-400"
          />
          <KpiCard
            title="Niveau Gaz MQ-2"
            value={
              typeof measurements?.gas_ppm === "number"
                ? `${numberFormat.format(measurements.gas_ppm)} ppm`
                : latestAlert
                  ? "Non transmis"
                  : noDataValue
            }
            subtext={
              latestAlert
                ? `Dernière lecture : ${formatDateTime(latestAlert.received_at)}`
                : "En attente d’une alerte."
            }
            icon={Wind}
            iconColor="text-amber-500"
          />
          <KpiCard
            title="Dernière alerte"
            value={latestAlert?.device_id ?? noDataValue}
            subtext={
              latestAlert
                ? `Reçue : ${formatDateTime(latestAlert.received_at)}`
                : "Aucune alerte reçue."
            }
            icon={AlertTriangle}
            iconColor="text-red-500"
            alert={Boolean(latestAlert)}
          />
        </section>

        <section className="flex-1 flex overflow-hidden">
          <CameraPanel />
          <EnvironmentalCharts
            alerts={alerts}
            loading={loading}
            error={error}
          />
        </section>

        <DashboardFooter
          alerts={alerts}
          connectionStatus={connectionStatus}
          loading={loading}
          error={error}
        />
      </main>
    </div>
  );
}
