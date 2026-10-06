import { useCallback, useState } from "react";
import type { ReactElement } from "react";
import {
  Activity,
  AlertTriangle,
  Server,
  Thermometer,
  Wind,
} from "lucide-react";

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

  const [personCount, setPersonCount] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [aiConnected, setAiConnected] = useState(false);

  const handleDetectionChange = useCallback(
    (
      count: number,
      detectionConfidence: number,
      connected: boolean
    ) => {
      setPersonCount(count);
      setConfidence(detectionConfidence);
      setAiConnected(connected);
    },
    []
  );

  const detectionValue = !aiConnected
    ? "IA déconnectée"
    : personCount > 0
      ? `${personCount} intrus détecté${personCount > 1 ? "s" : ""}`
      : "Aucun intrus";

  const detectionSubtext = !aiConnected
    ? "Serveur YOLO indisponible"
    : personCount > 0
      ? `YOLOv8 • Confiance: ${confidence}%`
      : "YOLOv8 • Surveillance active";

  return (
    <div className="dark min-h-screen bg-black text-neutral-300 font-sans flex">

      <DashboardSidebar />

      <main className="flex-1 flex flex-col h-screen overflow-hidden">

        {/* KPI */}
        <section className="grid grid-cols-5 border-b border-neutral-800">

          <KpiCard
            title="Statut Système"
            value="Opérationnel"
            subtext="Uptime: 72j • CPU 48% • RAM 63%"
            icon={Server}
            iconColor="text-emerald-500"
          />

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

          {/* KPI IA DYNAMIQUE */}
          <KpiCard
            title="Détection IA"
            value={detectionValue}
            subtext={detectionSubtext}
            icon={Activity}
            iconColor={
              personCount > 0
                ? "text-red-500"
                : "text-emerald-500"
            }
          />

          {/* ALERTE */}
          <KpiCard
            title="Alerte Critique"
            value={
              personCount > 0
                ? "Intrusion détectée"
                : "Sirène Inactive"
            }
            subtext={
              personCount > 0
                ? `${personCount} personne détectée • ${confidence}%`
                : "Aucune alerte active"
            }
            icon={AlertTriangle}
            iconColor={
              personCount > 0
                ? "text-red-500"
                : "text-emerald-500"
            }
            alert={personCount > 0}
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

        {/* CONTENU */}
        <section className="flex-1 flex overflow-hidden">

          <CameraPanel
            onDetectionChange={handleDetectionChange}
          />

          <EnvironmentalCharts />

        </section>

        <DashboardFooter />

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