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
  count: number;
  detections: Detection[];
}

interface CameraPanelProps {
  onDetectionChange?: (
    count: number,
    confidence: number,
    connected: boolean
  ) => void;
}

export default function CameraPanel({
  onDetectionChange,
}: CameraPanelProps) {
  const [detections, setDetections] = useState<Detection[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const getDetections = async () => {
      try {
        const response = await fetch(`${AI_SERVER}/detections`);

        if (!response.ok) {
          throw new Error("Erreur API");
        }

        const data: DetectionResponse = await response.json();

        setDetections(data.detections);
        setConnected(true);

        const count = data.detections.length;

        const confidence =
          count > 0
            ? Math.round(
                Math.max(
                  ...data.detections.map(
                    (detection) => detection.confidence
                  )
                ) * 100
              )
            : 0;

        onDetectionChange?.(count, confidence, true);
      } catch (error) {
        console.error("Erreur connexion YOLO :", error);

        setConnected(false);

        onDetectionChange?.(0, 0, false);
      }
    };

    getDetections();

    const interval = setInterval(getDetections, 500);

    return () => clearInterval(interval);
  }, [onDetectionChange]);

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
          {connected ? (
            <Badge className="bg-emerald-500 text-black">
              AI CONNECTÉE
            </Badge>
          ) : (
            <Badge variant="destructive">
              AI DÉCONNECTÉE
            </Badge>
          )}
        </div>

        {/* DÉTECTION */}
        <div className="absolute top-3 right-3">
          {personCount > 0 ? (
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

        {/* INFORMATIONS BAS */}
        <div className="absolute bottom-3 left-3 flex gap-3 text-xs font-mono text-emerald-400">

          <Badge className="bg-red-600 text-white">
            REC
          </Badge>

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
          AI: YOLOv8 • Conf: {confidence}%
        </span>

      </div>

    </section>
  );
}