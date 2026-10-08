import { useCallback, useEffect, useState } from "react";

const EVENTS_URL = "/api/v1/events";
const LATEST_EVENT_URL = `${EVENTS_URL}/latest`;

export interface EventInput {
  timestamp: string;
  source_type: "camera";
  source_id: string;
}

export interface Event extends EventInput {
  id: string;
  received_at: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isEvent(value: unknown): value is Event {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.timestamp === "string" &&
    Number.isFinite(Date.parse(value.timestamp)) &&
    value.source_type === "camera" &&
    typeof value.source_id === "string" &&
    typeof value.received_at === "string" &&
    Number.isFinite(Date.parse(value.received_at))
  );
}

function parseEventResponse(value: unknown): Event | null {
  if (
    !isRecord(value) ||
    !("data" in value) ||
    !(value.data === null || isEvent(value.data))
  ) {
    throw new Error("L’API a renvoyé un événement invalide.");
  }
  return value.data;
}

export function useEvents() {
  const [latestEvent, setLatestEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function loadLatestEvent() {
      try {
        const response = await fetch(LATEST_EVENT_URL, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`L’API a répondu avec le statut ${response.status}.`);
        }

        const event = parseEventResponse(await response.json());
        if (!active) return;
        if (event) {
          setLatestEvent((current) =>
            current &&
            Date.parse(current.received_at) > Date.parse(event.received_at)
              ? current
              : event,
          );
        }
        setError(null);
      } catch (cause) {
        if (!active || controller.signal.aborted) return;
        const message =
          cause instanceof Error ? cause.message : "Erreur inconnue.";
        console.error("Impossible de charger le dernier événement :", cause);
        setError(`Impossible de charger le dernier événement : ${message}`);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadLatestEvent();
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const createEvent = useCallback(
    async (input: EventInput): Promise<Event> => {
      try {
        const response = await fetch(EVENTS_URL, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!response.ok) {
          throw new Error(`L’API a répondu avec le statut ${response.status}.`);
        }

        const event = parseEventResponse(await response.json());
        if (!event) {
          throw new Error("L’API n’a pas renvoyé l’événement enregistré.");
        }
        setLatestEvent((current) =>
          current &&
          Date.parse(current.received_at) > Date.parse(event.received_at)
            ? current
            : event,
        );
        setError(null);
        return event;
      } catch (cause) {
        const message =
          cause instanceof Error ? cause.message : "Erreur inconnue.";
        setError(`Impossible d’enregistrer l’événement : ${message}`);
        throw cause;
      }
    },
    [],
  );

  return { latestEvent, loading, error, createEvent };
}
