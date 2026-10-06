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
  return (
    <div className="dark min-h-screen bg-black text-neutral-300 font-sans flex">
      <DashboardSidebar />

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
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
          <KpiCard
            title="Détection IA"
            value="Aucun intrus"
            subtext="Modèle: YOLOv8 • Latency: 42ms"
            icon={Activity}
            iconColor="text-emerald-500"
          />
          <KpiCard
            title="Alerte Critique"
            value="Sirène Inactive"
            subtext="Dernière alerte: 2026-09-28 03:18 UTC"
            icon={AlertTriangle}
            iconColor="text-red-500"
            alert
          />
        </section>

        <section className="flex-1 flex overflow-hidden">
          <CameraPanel />
          <EnvironmentalCharts />
        </section>

        <DashboardFooter />
      </main>
    </div>
  );
}
