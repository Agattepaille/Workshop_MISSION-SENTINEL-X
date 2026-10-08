import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Minus,
  Plus,
  RotateCcw,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const MAX_POSITION = 10;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.5;

export default function CameraControls() {
  const [pan, setPan] = useState(0);
  const [tilt, setTilt] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [lastAction, setLastAction] = useState("Aucune commande simulée.");

  function movePan(direction: -1 | 1) {
    setPan((current) =>
      Math.max(-MAX_POSITION, Math.min(MAX_POSITION, current + direction)),
    );
    setLastAction(
      direction < 0
        ? "Panoramique gauche simulé."
        : "Panoramique droite simulé.",
    );
  }

  function moveTilt(direction: -1 | 1) {
    setTilt((current) =>
      Math.max(-MAX_POSITION, Math.min(MAX_POSITION, current + direction)),
    );
    setLastAction(
      direction > 0 ? "Inclinaison haut simulée." : "Inclinaison bas simulée.",
    );
  }

  function changeZoom(direction: -1 | 1) {
    setZoom((current) =>
      Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, current + direction * ZOOM_STEP)),
    );
    setLastAction(
      direction > 0 ? "Zoom avant simulé." : "Zoom arrière simulé.",
    );
  }

  function resetPosition() {
    setPan(0);
    setTilt(0);
    setZoom(1);
    setLastAction("Position simulée réinitialisée.");
  }

  return (
    <section
      className="mx-4 mt-4 rounded border border-neutral-800 bg-neutral-950 p-4"
      aria-labelledby="camera-controls-title"
    >
      <div className="flex items-center justify-end gap-2">
        <span className="rounded bg-amber-500/15 px-2 py-1 text-[10px] font-bold tracking-wide text-amber-300">
          Contrôle de la caméra
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div
          className="grid grid-cols-3 gap-1"
          role="group"
          aria-label="Déplacement de la caméra"
        >
          <span />
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800 hover:text-white"
            aria-label="Incliner vers le haut"
            onClick={() => moveTilt(1)}
            disabled={tilt === MAX_POSITION}
          >
            <ArrowUp aria-hidden="true" />
          </Button>
          <span />
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800 hover:text-white"
            aria-label="Pivoter vers la gauche"
            onClick={() => movePan(-1)}
            disabled={pan === -MAX_POSITION}
          >
            <ArrowLeft aria-hidden="true" />
          </Button>
          <span className="flex size-7 items-center justify-center text-[10px] font-bold text-neutral-500">
            PTZ
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800 hover:text-white"
            aria-label="Pivoter vers la droite"
            onClick={() => movePan(1)}
            disabled={pan === MAX_POSITION}
          >
            <ArrowRight aria-hidden="true" />
          </Button>
          <span />
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800 hover:text-white"
            aria-label="Incliner vers le bas"
            onClick={() => moveTilt(-1)}
            disabled={tilt === -MAX_POSITION}
          >
            <ArrowDown aria-hidden="true" />
          </Button>
          <span />
        </div>

        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-neutral-400">Zoom</span>
          <div
            className="flex items-center gap-1"
            role="group"
            aria-label="Zoom"
          >
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800 hover:text-white"
              aria-label="Réduire le zoom"
              onClick={() => changeZoom(-1)}
              disabled={zoom === MIN_ZOOM}
            >
              <Minus aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800 hover:text-white"
              aria-label="Augmenter le zoom"
              onClick={() => changeZoom(1)}
              disabled={zoom === MAX_ZOOM}
            >
              <Plus aria-hidden="true" />
            </Button>
          </div>
          <span className="font-mono text-xs text-emerald-400">
            {zoom.toFixed(1)}×
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-neutral-800 pt-2">
        <p
          className="font-mono text-[10px] text-neutral-400"
          aria-live="polite"
        >
          Pan {pan > 0 ? "+" : ""}
          {pan} · Tilt {tilt > 0 ? "+" : ""}
          {tilt}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-neutral-400 hover:text-white"
          aria-label="Réinitialiser la position"
          onClick={resetPosition}
        >
          <RotateCcw aria-hidden="true" />
        </Button>
      </div>
      <p className="sr-only" aria-live="polite">
        {lastAction}
      </p>
    </section>
  );
}
