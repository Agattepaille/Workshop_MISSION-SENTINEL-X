import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

const AI_SERVER = "http://127.0.0.1:5001";

type ServiceStatus = "connecting" | "connected" | "disconnected";
type CameraStatus = "starting" | "active" | "unavailable" | "error";

export interface CameraDetectionSummary {
  serviceStatus: ServiceStatus;
  cameraStatus: CameraStatus;
  count: number;
  confidence: number;
}

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
  camera_status?: CameraStatus;
  count: number;
  detections: Detection[];
  latency_ms: number;
  fps: number;
  performance: "OK" | "SLOW";
  resolution: {
    width: number;
    height: number;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDetection(value: unknown): value is Detection {
  if (!isRecord(value) || !isRecord(value.bbox)) {
    return false;
  }

  return (
    typeof value.class === "string" &&
    typeof value.confidence === "number" &&
    typeof value.bbox.x1 === "number" &&
    typeof value.bbox.x2 === "number" &&
    typeof value.bbox.y1 === "number" &&
    typeof value.bbox.y2 === "number"
  );
}

function isDetectionResponse(value: unknown): value is DetectionResponse {
  if (!isRecord(value) || !isRecord(value.resolution)) {
    return false;
  }

  const cameraStatus = value.camera_status;
  return (
    typeof value.count === "number" &&
    Array.isArray(value.detections) &&
    value.detections.every(isDetection) &&
    typeof value.latency_ms === "number" &&
    typeof value.fps === "number" &&
    (value.performance === "OK" || value.performance === "SLOW") &&
    typeof value.resolution.width === "number" &&
    typeof value.resolution.height === "number" &&
    (cameraStatus === undefined ||
      cameraStatus === "starting" ||
      cameraStatus === "active" ||
      cameraStatus === "unavailable" ||
      cameraStatus === "error")
  );
}

interface CameraPanelProps {
  onDetectionChange: (summary: CameraDetectionSummary) => void;
}

export default function CameraPanel({
  onDetectionChange,
}: CameraPanelProps) {
  const [detections, setDetections] = useState<Detection[]>([]);
  const [serviceStatus, setServiceStatus] =
    useState<ServiceStatus>("connecting");
  const [cameraStatus, setCameraStatus] =
    useState<CameraStatus>("starting");
  const [latency, setLatency] = useState(0);
  const [fps, setFps] = useState(0);
  const [resolution, setResolution] = useState({
    width: 640,
    height: 480,
  });
  const [performance, setPerformance] = useState<"OK" | "SLOW">("OK");

  useEffect(() => {
    let mounted = true;

    const getDetections = async () => {
      try {
        const response = await fetch(`${AI_SERVER}/detections`);

        if (!response.ok) {
          throw new Error(
            `Le service IA a répondu avec le statut ${response.status}.`,
          );
        }

        const payload: unknown = await response.json();
        if (!isDetectionResponse(payload)) {
          throw new Error("Le service IA a renvoyé un état de caméra invalide.");
        }

        if (!mounted) {
          return;
        }

        const nextCameraStatus = payload.camera_status ?? "active";
        const confidence =
          payload.detections.length > 0
            ? Math.round(
                Math.max(
                  ...payload.detections.map(
                    (detection) => detection.confidence,
                  ),
                ) * 100,
              )
            : 0;

        setDetections(payload.detections);
        setLatency(payload.latency_ms);
        setFps(payload.fps);
        setResolution(payload.resolution);
        setPerformance(payload.performance);
        setServiceStatus("connected");
        setCameraStatus(nextCameraStatus);
        onDetectionChange({
          serviceStatus: "connected",
          cameraStatus: nextCameraStatus,
          count: payload.detections.length,
          confidence,
        });
      } catch (error) {
        if (!mounted) {
          return;
        }

        console.error("Erreur connexion YOLO :", error);
        setDetections([]);
        setLatency(0);
        setFps(0);
        setServiceStatus("disconnected");
        onDetectionChange({
          serviceStatus: "disconnected",
          cameraStatus,
          count: 0,
          confidence: 0,
        });
      }
    };

    void getDetections();
    const interval = setInterval(() => void getDetections(), 1000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [cameraStatus, onDetectionChange]);

  const cameraActive =
    serviceStatus === "connected" && cameraStatus === "active";
  const personCount = detections.length;
  const confidence =
    personCount > 0
      ? Math.round(
          Math.max(
            ...detections.map((detection) => detection.confidence),
          ) * 100,
        )
      : 0;
  const statusMessage =
    serviceStatus === "connecting"
      ? "Connexion au service de vision en cours…"
      : serviceStatus === "disconnected"
        ? "Service IA inaccessible. Vérifiez que le serveur YOLO est démarré."
        : cameraStatus === "starting"
          ? "Initialisation de la caméra et du modèle YOLO…"
          : cameraStatus === "unavailable"
            ? "Caméra inactive ou inaccessible. Vérifiez qu’elle est branchée et activée."
            : cameraStatus === "error"
              ? "Erreur de détection YOLO. Consultez les logs du serveur IA."
              : null;
  const statusIsError =
    serviceStatus === "disconnected" ||
    cameraStatus === "unavailable" ||
    cameraStatus === "error";

  return (
    <section className="flex min-w-0 flex-1 flex-col border-r border-neutral-800 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">
          Caméra USB - Zone 3 (Entrée Est)
        </h2>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-neutral-500">AI Vision • YOLOv8n</span>
          {serviceStatus === "connected" ? (
            <Badge className="bg-emerald-500 text-black">CONNECTÉE</Badge>
          ) : (
            <Badge variant="destructive">
              {serviceStatus === "connecting" ? "CONNEXION…" : "DÉCONNECTÉE"}
            </Badge>
          )}
        </div>
      </div>

      <Card className="relative min-h-0 flex-1 overflow-hidden rounded-none border border-neutral-800 bg-black p-0">
        <div className="flex h-full w-full items-center justify-center">
          <img
            src={`${AI_SERVER}/video`}
            alt="Flux vidéo de la caméra avec détection YOLO"
            className="h-full w-full object-contain"
          />
        </div>

        <div className="absolute left-3 top-3">
          {performance === "OK" ? (
            <Badge className="bg-emerald-500 text-black">
              AI OK • {latency.toFixed(0)} ms
            </Badge>
          ) : (
            <Badge className="bg-amber-500 text-black">
              AI LENTE • {latency.toFixed(0)} ms
            </Badge>
          )}
        </div>

        <div className="absolute right-3 top-3">
          {personCount > 0 ? (
            <Badge variant="destructive">
              {personCount} PERSONNE{personCount > 1 ? "S" : ""} • {confidence}%
            </Badge>
          ) : (
            <Badge className="bg-emerald-500 text-black">
              AUCUNE PERSONNE
            </Badge>
          )}
        </div>

        <div className="absolute bottom-3 left-3 flex gap-3 font-mono text-xs text-emerald-400">
          {cameraActive && (
            <Badge className="bg-red-600 text-white">REC</Badge>
          )}
          <span>YOLOv8n</span>
          <span>
            {resolution.width}×{resolution.height}
          </span>
          <span>{fps.toFixed(1)} FPS</span>
        </div>

        {statusMessage && (
          <div
            className={`absolute inset-x-3 bottom-12 rounded bg-black/80 p-3 text-sm ${
              statusIsError ? "text-red-300" : "text-neutral-300"
            }`}
            role={statusIsError ? "alert" : "status"}
          >
            {statusMessage}
          </div>
        )}
      </Card>

      <div className="mt-2 flex justify-between font-mono text-[10px] text-neutral-500">
        <span>Source: USB • CAM-ENT-03</span>
        <span>Latence : {latency.toFixed(2)} ms</span>
      </div>
    </section>
  );
}
