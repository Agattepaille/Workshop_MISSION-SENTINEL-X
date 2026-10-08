export class AlertReadValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = "AlertReadValidationError";
    this.details = details;
  }
}

function invalidParameter(field, message) {
  return new AlertReadValidationError("Invalid alert query parameters.", [
    { field, message },
  ]);
}

function parseTimestamp(value, field) {
  const invalidTimestamp = () =>
    invalidParameter(field, "Timestamp must be an ISO 8601 UTC timestamp.");
  if (typeof value !== "string") throw invalidTimestamp();

  const timestamp = new Date(value);
  if (
    !Number.isFinite(timestamp.getTime()) ||
    timestamp.toISOString() !== value
  ) {
    throw invalidTimestamp();
  }
  return timestamp.toISOString();
}

function parseTimeRange(since, to) {
  if (since === undefined && to === undefined) return undefined;
  if (since === undefined) {
    throw invalidParameter("since", "Both since and to are required.");
  }
  if (to === undefined) {
    throw invalidParameter("to", "Both since and to are required.");
  }

  const from = parseTimestamp(since, "since");
  const until = parseTimestamp(to, "to");
  if (from > until) {
    throw invalidParameter("since", "Since must not be later than to.");
  }
  return { from, to: until };
}

export function createAlertReadService({ alertRepository }) {
  return {
    async list({ since, to } = {}) {
      const timeRange = parseTimeRange(since, to);
      const data =
        timeRange === undefined
          ? await alertRepository.listAll()
          : await alertRepository.listBetween(timeRange);
      return { data };
    },
  };
}
