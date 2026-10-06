import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

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
  camera_status: CameraStatus;
  count: number;
  detections: Detection[];
}

type CameraStatus = "starting" | "active" | "unavailable" | "error";
type ServiceStatus = "connecting" | "connected" | "disconnected";

export interface CameraDetectionSummary {
  serviceStatus: ServiceStatus;
  cameraStatus: CameraStatus;
  count: number;
  confidence: number;
}

interface CameraPanelProps {
  onDetectionChange?: (summary: CameraDetectionSummary) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isCameraStatus(value: unknown): value is CameraStatus {
  return (
    value === "starting" ||
    value === "active" ||
    value === "unavailable" ||
    value === "error"
  );
}

function isDetection(value: unknown): value is Detection {
  if (
    !isRecord(value) ||
    typeof value.class !== "string" ||
    typeof value.confidence !== "number" ||
    !Number.isFinite(value.confidence) ||
    !isRecord(value.bbox)
  ) {
    return false;
  }

  const bbox = value.bbox;
  return ["x1", "x2", "y1", "y2"].every((coordinate) => {
    const valueAtCoordinate = bbox[coordinate];
    return (
      typeof valueAtCoordinate === "number" &&
      Number.isFinite(valueAtCoordinate)
    );
  });
}

function isDetectionResponse(value: unknown): value is DetectionResponse {
  return (
    isRecord(value) &&
    isCameraStatus(value.camera_status) &&
    typeof value.count === "number" &&
    Number.isInteger(value.count) &&
    Array.isArray(value.detections) &&
    value.detections.every(isDetection) &&
    value.count === value.detections.length
  );
}

export default function CameraPanel({
  onDetectionChange,
}: CameraPanelProps) {
  const [detections, setDetections] = useState<Detection[]>([]);
  const [serviceStatus, setServiceStatus] =
    useState<ServiceStatus>("connecting");
  const [cameraStatus, setCameraStatus] =
    useState<CameraStatus>("starting");

  useEffect(() => {
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

        setServiceStatus("connected");
        setCameraStatus(payload.camera_status);

        const currentDetections =
          payload.camera_status === "active" ? payload.detections : [];
        setDetections(currentDetections);

        const confidence =
          currentDetections.length > 0
            ? Math.round(
                Math.max(
                  ...currentDetections.map((detection) => detection.confidence),
                ) * 100
              )
            : 0;

        onDetectionChange?.({
          serviceStatus: "connected",
          cameraStatus: payload.camera_status,
          count: currentDetections.length,
          confidence,
        });
      } catch (error) {
        console.error("Erreur connexion YOLO :", error);

        setServiceStatus("disconnected");
        setCameraStatus("unavailable");
        setDetections([]);

        onDetectionChange?.({
          serviceStatus: "disconnected",
          cameraStatus: "unavailable",
          count: 0,
          confidence: 0,
        });
      }
    };

    getDetections();

    const interval = setInterval(getDetections, 500);

    return () => clearInterval(interval);
  }, [onDetectionChange]);

  const cameraActive =
    serviceStatus === "connected" && cameraStatus === "active";
  const personCount = detections.length;

  const confidence =
    personCount > 0
      ? Math.round(
          Math.max(
            ...detections.map(
              (detection) => detection.confidence
            )
          ) * 100
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
    <section className="flex-1 min-w-0 border-r border-neutral-800 p-4 flex flex-col">

      <div className="flex justify-between items-center mb-3">
        <h2 className="text-white text-sm font-semibold">
          Caméra USB - Zone 3 (Entrée Est)
        </h2>

        <span className="text-neutral-500 text-xs">
          AI Vision • YOLOv8 • 15fps
        </span>
      </div>

      <Card className="relative flex-1 min-h-0 rounded-none border border-neutral-800 bg-black p-0 overflow-hidden">

        <div className="w-full h-full flex items-center justify-center">
          <img
            src={`${AI_SERVER}/video`}
            alt="Caméra avec détection YOLO"
            className="w-full h-full object-contain"
          />
        </div>

        {/* STATUT IA */}
        <div className="absolute top-3 left-3">
          {cameraActive ? (
            <Badge className="bg-emerald-500 text-black">
              AI CONNECTÉE
            </Badge>
          ) : serviceStatus === "connecting" ||
            (serviceStatus === "connected" && cameraStatus === "starting") ? (
            <Badge className="bg-amber-400 text-black">
              INITIALISATION
            </Badge>
          ) : (
            <Badge variant="destructive">
              {serviceStatus === "disconnected"
                ? "SERVICE IA HORS LIGNE"
                : cameraStatus === "error"
                  ? "ERREUR DE DÉTECTION"
                  : "CAMÉRA INDISPONIBLE"}
            </Badge>
          )}
        </div>

        {/* DÉTECTION */}
        <div className="absolute top-3 right-3">
          {!cameraActive ? (
            <Badge variant="outline" className="border-amber-400 text-amber-300">
              DÉTECTION INDISPONIBLE
            </Badge>
          ) : personCount > 0 ? (
            <Badge variant="destructive">
              {personCount} PERSONNE
              {personCount > 1 ? "S" : ""} • {confidence}%
            </Badge>
          ) : (
            <Badge className="bg-emerald-500 text-black">
              AUCUNE PERSONNE
            </Badge>
          )}
        </div>

        {statusMessage && (
          <div
            className={`absolute left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 border p-4 text-center text-sm ${
              statusIsError
                ? "border-red-900 bg-black/90 text-red-300"
                : "border-amber-700 bg-black/90 text-amber-200"
            }`}
            role={statusIsError ? "alert" : "status"}
            aria-live="polite"
          >
            {statusMessage}
          </div>
        )}

        {/* INFORMATIONS BAS */}
        <div className="absolute bottom-3 left-3 flex gap-3 text-xs font-mono text-emerald-400">
          {cameraActive && (
            <Badge className="bg-red-600 text-white">REC</Badge>
          )}

          <span>YOLOv8</span>

          <span>
            {personCount} détection
            {personCount > 1 ? "s" : ""}
          </span>

        </div>

      </Card>

      <div className="flex justify-between mt-2 text-[10px] text-neutral-500 font-mono">

        <span>
          Source: /dev/video0 • USB • ID: CAM-ENT-03
        </span>

        <span>
          {cameraActive
            ? `AI: YOLOv8 • Conf: ${confidence}%`
            : "Détection inactive"}
        </span>

      </div>

    </section>
  );
}