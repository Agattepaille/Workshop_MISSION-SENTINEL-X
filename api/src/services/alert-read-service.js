const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function parseLimit(value) {
  if (value === undefined) return DEFAULT_LIMIT;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    throw invalidParameter(
      "limit",
      `Limit must be an integer between 1 and ${MAX_LIMIT}.`,
    );
  }

  const limit = Number(value);
  if (limit > MAX_LIMIT) {
    throw invalidParameter(
      "limit",
      `Limit must be an integer between 1 and ${MAX_LIMIT}.`,
    );
  }
  return limit;
}

function parseCursor(value) {
  if (value === undefined) return undefined;
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    !/^[A-Za-z0-9_-]+$/.test(value)
  ) {
    throw invalidParameter("cursor", "Cursor is malformed.");
  }

  let decoded;
  try {
    const json = Buffer.from(value, "base64url").toString("utf8");
    if (Buffer.from(json, "utf8").toString("base64url") !== value) {
      throw new Error("Non-canonical cursor.");
    }
    decoded = JSON.parse(json);
  } catch {
    throw invalidParameter("cursor", "Cursor is malformed.");
  }

  if (
    decoded === null ||
    typeof decoded !== "object" ||
    Array.isArray(decoded) ||
    typeof decoded.timestamp !== "string" ||
    typeof decoded.alertId !== "string" ||
    !UUID_PATTERN.test(decoded.alertId)
  ) {
    throw invalidParameter("cursor", "Cursor is malformed.");
  }

  let canonicalTimestamp;
  try {
    canonicalTimestamp = new Date(decoded.timestamp).toISOString();
  } catch {
    throw invalidParameter("cursor", "Cursor is malformed.");
  }
  if (canonicalTimestamp !== decoded.timestamp) {
    throw invalidParameter("cursor", "Cursor is malformed.");
  }

  return {
    timestamp: canonicalTimestamp,
    alertId: decoded.alertId,
  };
}

function encodeCursor(cursor) {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function createAlertReadService({ alertRepository }) {
  return {
    async list({ limit, cursor } = {}) {
      const page = await alertRepository.listPage({
        limit: parseLimit(limit),
        cursor: parseCursor(cursor),
      });

      return {
        data: page.data,
        pagination: {
          next_cursor: page.nextCursor ? encodeCursor(page.nextCursor) : null,
          has_more: page.hasMore,
        },
      };
    },
  };
}
