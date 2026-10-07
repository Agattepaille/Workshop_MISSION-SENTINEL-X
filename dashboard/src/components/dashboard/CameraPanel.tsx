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
  latency_ms: number;
  fps: number;
  performance: "OK" | "SLOW";
  resolution: {
    width: number;
    height: number;
  };
}

export default function CameraPanel() {
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

        console.log("YOLO :", data);

        setDetections(data.detections);

        setLatency(data.latency_ms);
        setFps(data.fps);

        setResolution(data.resolution);

        setPerformance(data.performance);

        setConnected(true);
      } catch (error) {
        console.error("Erreur connexion YOLO :", error);

        setConnected(false);
      }
    };

    getDetections();

    const interval = setInterval(getDetections, 500);

    return () => clearInterval(interval);
  }, []);

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

      {/* HEADER */}
      <div className="flex justify-between items-center mb-3">

        <h2 className="text-white text-sm font-semibold">
          Caméra USB - Zone 3 (Entrée Est)
        </h2>

        <div className="flex items-center gap-3 text-xs">

          <span className="text-neutral-500">
            AI Vision • YOLOv8n
          </span>

          {connected ? (
            <Badge className="bg-emerald-500 text-black">
              CONNECTÉE
            </Badge>
          ) : (
            <Badge variant="destructive">
              DÉCONNECTÉE
            </Badge>
          )}

        </div>

      </div>

      {/* VIDEO */}
      <Card className="relative flex-1 min-h-0 rounded-none border border-neutral-800 bg-black p-0 overflow-hidden">

        <div className="w-full h-full flex items-center justify-center">

          <img
            src={`${AI_SERVER}/video`}
            alt="Caméra avec détection YOLO"
            className="w-full h-full object-contain"
          />

        </div>

        {/* STATUS IA */}
        <div className="absolute top-3 left-3">

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

        {/* DETECTION */}
        <div className="absolute top-3 right-3">

          {personCount > 0 ? (

            <Badge variant="destructive">

              {personCount} PERSONNE
              {personCount > 1 ? "S" : ""}

              {" • "}

              {confidence}%

            </Badge>

          ) : (

            <Badge className="bg-emerald-500 text-black">

              AUCUNE PERSONNE

            </Badge>

          )}

        </div>

        {/* INFORMATIONS VIDEO */}
        <div className="absolute bottom-3 left-3 flex gap-3 text-xs font-mono text-emerald-400">
          {cameraActive && (
            <Badge className="bg-red-600 text-white">REC</Badge>
          )}

          <span>
            YOLOv8n
          </span>

          <span>
            {resolution.width}×{resolution.height}
          </span>

          <span>
            {fps.toFixed(1)} FPS
          </span>

        </div>

      </Card>

      {/* INFORMATIONS */}
      <div className="flex justify-between mt-2 text-[10px] text-neutral-500 font-mono">

        <span>
          Source: USB • CAM-ENT-03
        </span>

        <span>
          Latency: {latency.toFixed(2)} ms
        </span>

      </div>

    </section>
  );
}