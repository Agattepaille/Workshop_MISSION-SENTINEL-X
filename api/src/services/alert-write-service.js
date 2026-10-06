import { randomUUID } from "node:crypto";

export class AlertValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = "AlertValidationError";
    this.details = details;
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateAlert(value) {
  const details = [];
  if (!isRecord(value)) {
    throw new AlertValidationError("Alert must be a JSON object.");
  }

  const allowedKeys = new Set([
    "timestamp",
    "device_id",
    "measurements",
    "sensor_states",
  ]);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      details.push({ field: key, message: "Unknown field." });
    }
  }

  let timestamp;
  if (typeof value.timestamp !== "string") {
    details.push({
      field: "timestamp",
      message: "A timestamp in RFC 3339 format is required.",
    });
  } else {
    const match =
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(
        value.timestamp,
      );
    if (!match) {
      details.push({
        field: "timestamp",
        message: "Timestamp must use RFC 3339 format with a timezone.",
      });
    } else {
      const [
        ,
        yearText,
        monthText,
        dayText,
        hourText,
        minuteText,
        secondText,
        zone,
      ] = match;
      const year = Number(yearText);
      const month = Number(monthText);
      const day = Number(dayText);
      const hour = Number(hourText);
      const minute = Number(minuteText);
      const second = Number(secondText);
      const calendarDate = new Date(0);
      calendarDate.setUTCFullYear(year, month - 1, day);
      calendarDate.setUTCHours(0, 0, 0, 0);
      const validDate =
        year > 0 &&
        calendarDate.getUTCFullYear() === year &&
        calendarDate.getUTCMonth() === month - 1 &&
        calendarDate.getUTCDate() === day &&
        hour <= 23 &&
        minute <= 59 &&
        second <= 59;
      const zoneMatch = /^([+-])(\d{2}):(\d{2})$/.exec(zone);
      const validZone =
        zone === "Z" ||
        Boolean(
          zoneMatch && Number(zoneMatch[2]) <= 23 && Number(zoneMatch[3]) <= 59,
        );
      const parsedTimestamp = Date.parse(value.timestamp);
      if (!validDate || !validZone || !Number.isFinite(parsedTimestamp)) {
        details.push({
          field: "timestamp",
          message: "Timestamp must be a valid RFC 3339 date and time.",
        });
      } else {
        timestamp = new Date(parsedTimestamp).toISOString();
      }
    }
  }

  if (
    typeof value.device_id !== "string" ||
    value.device_id.trim().length === 0 ||
    value.device_id.length > 128
  ) {
    details.push({
      field: "device_id",
      message: "A non-empty device_id of at most 128 characters is required.",
    });
  }

  const measurements =
    value.measurements === undefined ? {} : value.measurements;
  if (!isRecord(measurements)) {
    details.push({
      field: "measurements",
      message: "Measurements must be an object of finite numbers.",
    });
  } else {
    for (const [name, reading] of Object.entries(measurements)) {
      if (
        name.length === 0 ||
        name.length > 64 ||
        typeof reading !== "number" ||
        !Number.isFinite(reading)
      ) {
        details.push({
          field: `measurements.${name}`,
          message:
            "Measurement names must be 1-64 characters and values must be finite numbers.",
        });
      }
    }
  }

  const sensorStates =
    value.sensor_states === undefined ? {} : value.sensor_states;
  if (!isRecord(sensorStates)) {
    details.push({
      field: "sensor_states",
      message: "Sensor states must be an object of strings or booleans.",
    });
  } else {
    for (const [name, state] of Object.entries(sensorStates)) {
      if (
        name.length === 0 ||
        name.length > 64 ||
        !(
          typeof state === "boolean" ||
          (typeof state === "string" && state.length > 0 && state.length <= 64)
        )
      ) {
        details.push({
          field: `sensor_states.${name}`,
          message:
            "Sensor state names must be 1-64 characters and values must be booleans or 1-64 character strings.",
        });
      }
    }
  }

  if (details.length > 0) {
    throw new AlertValidationError("Alert contains invalid fields.", details);
  }

  return {
    timestamp,
    device_id: value.device_id.trim(),
    measurements,
    sensor_states: sensorStates,
  };
}

export function createAlertWriteService({ alertRepository }) {
  return {
    async create(input) {
      const alert = validateAlert(input);
      const receivedAt = new Date().toISOString();
      const id = randomUUID();
      await alertRepository.save(alert, receivedAt, id);

      return {
        id,
        ...alert,
        received_at: receivedAt,
      };
    },
  };
}
