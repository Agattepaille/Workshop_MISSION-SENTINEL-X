import { useEffect, useState, type ReactElement } from "react";
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

const AI_SERVER = "http://127.0.0.1:5001";

interface Detection {
  class: string;
  confidence: number;
  bbox: {
    x1: number;
    x2: number;
    y1: number;
    y2: number;
  };
}

interface DetectionResponse {
  count: number;
  detections: Detection[];
  fps?: number;
  latency_ms?: number;
  performance?: string;
  resolution?: {
    width: number;
    height: number;
  };
}

export default function SentinelDashboard(): ReactElement {
  const [aiConnected, setAiConnected] = useState(false);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    const getAIStatus = async () => {
      try {
        const response = await fetch(`${AI_SERVER}/detections`);

        if (!response.ok) {
          throw new Error("Serveur YOLO indisponible");
        }

        const data: DetectionResponse = await response.json();

        setAiConnected(true);
        setDetections(data.detections || []);

        if (typeof data.latency_ms === "number") {
          setLatency(data.latency_ms);
        }
      } catch (error) {
        console.error("Erreur connexion YOLO :", error);

        setAiConnected(false);
        setDetections([]);
        setLatency(null);
      }
    };

    getAIStatus();

    const interval = setInterval(getAIStatus, 1000);

    return () => clearInterval(interval);
  }, []);

  const personCount = detections.length;

  const confidence =
    personCount > 0
      ? Math.round(
          Math.max(
            ...detections.map((detection) => detection.confidence)
          ) * 100
        )
      : 0;

  const aiValue = !aiConnected
    ? "IA déconnectée"
    : personCount > 0
      ? `${personCount} intrus détecté${personCount > 1 ? "s" : ""}`
      : "Aucun intrus";

  const aiSubtext = !aiConnected
    ? "Serveur YOLO indisponible"
    : personCount > 0
      ? `YOLOv8n • Confiance: ${confidence}%${
          latency !== null ? ` • ${Math.round(latency)}ms` : ""
        }`
      : `YOLOv8n • Surveillance active${
          latency !== null ? ` • ${Math.round(latency)}ms` : ""
        }`;

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

          {/* KPI VISION IA */}
          <KpiCard
            title="Détection IA"
            value={aiValue}
            subtext={aiSubtext}
            icon={Activity}
            iconColor={
              !aiConnected
                ? "text-red-500"
                : personCount > 0
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
                ? `${personCount} personne${
                    personCount > 1 ? "s" : ""
                  } détectée${
                    personCount > 1 ? "s" : ""
                  } • ${confidence}%`
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
          <CameraPanel />
          <EnvironmentalCharts />
        </section>

        <DashboardFooter />
      </main>
    </div>
  );
}