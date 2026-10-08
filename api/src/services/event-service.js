import { randomUUID } from "node:crypto";

export class EventValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = "EventValidationError";
    this.details = details;
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateTimestamp(value, details) {
  const match =
    typeof value === "string" &&
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(
      value,
    );
  if (!match) {
    details.push({
      field: "timestamp",
      message: "A timestamp in RFC 3339 format with timezone is required.",
    });
    return undefined;
  }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText] =
    match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const calendarDate = new Date(0);
  calendarDate.setUTCFullYear(year, month - 1, day);
  calendarDate.setUTCHours(0, 0, 0, 0);
  const parsedTimestamp = Date.parse(value);
  if (
    year <= 0 ||
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    !Number.isFinite(parsedTimestamp)
  ) {
    details.push({
      field: "timestamp",
      message: "Timestamp must be a valid RFC 3339 date and time.",
    });
    return undefined;
  }

  return new Date(parsedTimestamp).toISOString();
}

function validateEvent(value) {
  if (!isRecord(value)) {
    throw new EventValidationError("Event must be a JSON object.");
  }

  const details = [];
  const allowedKeys = new Set(["timestamp", "source_type", "source_id"]);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      details.push({ field: key, message: "Unknown field." });
    }
  }

  const timestamp = validateTimestamp(value.timestamp, details);
  if (value.source_type !== "camera") {
    details.push({
      field: "source_type",
      message: 'source_type must be "camera".',
    });
  }
  if (
    typeof value.source_id !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value.source_id)
  ) {
    details.push({
      field: "source_id",
      message:
        "A source_id containing 1-128 letters, numbers, dots, underscores or hyphens is required.",
    });
  }

  if (details.length > 0) {
    throw new EventValidationError("Event contains invalid fields.", details);
  }

  return {
    timestamp,
    source_type: value.source_type,
    source_id: value.source_id,
  };
}

export function createEventService({ eventRepository }) {
  return {
    async create(input) {
      const event = validateEvent(input);
      const receivedAt = new Date().toISOString();
      const id = randomUUID();
      await eventRepository.saveEvent(event, receivedAt, id);
      return {
        id,
        ...event,
        received_at: receivedAt,
      };
    },

    async latest() {
      return eventRepository.getLatestEvent();
    },
  };
}
