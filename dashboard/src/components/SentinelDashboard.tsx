import { useCallback, useState } from "react";
import type { ReactElement } from "react";
import {
  Activity,
  AlertTriangle,
  Server,
  Thermometer,
  Wind,
} from "lucide-react";

import CameraPanel from "./dashboard/CameraPanel";
import DashboardFooter from "./dashboard/DashboardFooter";
import DashboardSidebar from "./dashboard/DashboardSidebar";
import EnvironmentalCharts from "./dashboard/EnvironmentalCharts";
import KpiCard from "./dashboard/KpiCard";

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

          <KpiCard
            title="Température DHT22"
            value="24.6°C / 55% RH"
            subtext="Dernière lecture: 00:12:04"
            icon={Thermometer}
            iconColor="text-cyan-400"
          />

          <KpiCard
            title="Niveau Gaz MQ-2"
            value="210 ppm"
            subtext="Seuil: 400 ppm"
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

      </main>
    </div>
  );
}