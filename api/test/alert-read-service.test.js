import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AlertReadValidationError,
  createAlertReadService,
} from "../src/services/alert-read-service.js";

const alert = {
  id: "71a3eea1-6cdd-4af9-9aa1-bcbcc6d5268f",
  timestamp: "2026-10-05T12:00:00.000Z",
  device_id: "esp8266-demo",
  measurements: { temperature_c: 21.4 },
  sensor_states: { motion: false },
  received_at: "2026-10-05T12:00:01.000Z",
};

test("lists alerts and encodes the next cursor for the next page", async () => {
  let repositoryArguments;
  const service = createAlertReadService({
    alertRepository: {
      async listPage(arguments_) {
        repositoryArguments = arguments_;
        return {
          data: [alert],
          hasMore: true,
          nextCursor: {
            timestamp: alert.timestamp,
            alertId: alert.id,
          },
        };
      },
    },
  });

  const result = await service.list({ limit: "1" });

  assert.deepEqual(repositoryArguments, { limit: 1, cursor: undefined });
  assert.deepEqual(result.data, [alert]);
  assert.equal(result.pagination.has_more, true);
  assert.deepEqual(
    JSON.parse(
      Buffer.from(result.pagination.next_cursor, "base64url").toString("utf8"),
    ),
    { timestamp: alert.timestamp, alertId: alert.id },
  );
});

test("uses the default limit and omits the cursor when there is no next page", async () => {
  let repositoryArguments;
  const service = createAlertReadService({
    alertRepository: {
      async listPage(arguments_) {
        repositoryArguments = arguments_;
        return { data: [alert], hasMore: false, nextCursor: null };
      },
    },
  });

  const result = await service.list();

  assert.deepEqual(repositoryArguments, { limit: 50, cursor: undefined });
  assert.equal(result.pagination.next_cursor, null);
  assert.equal(result.pagination.has_more, false);
});

test("lists alerts from the requested timestamp range", async () => {
  let repositoryArguments;
  const service = createAlertReadService({
    alertRepository: {
      async listBetween(arguments_) {
        repositoryArguments = arguments_;
        return [alert];
      },
    },
  });

  const result = await service.list({
    since: "2026-10-07T00:00:00.000Z",
    to: "2026-10-07T12:00:00.000Z",
  });

  assert.deepEqual(repositoryArguments, {
    from: "2026-10-07T00:00:00.000Z",
    to: "2026-10-07T12:00:00.000Z",
  });
  assert.deepEqual(result.data, [alert]);
  assert.deepEqual(result.pagination, {
    next_cursor: null,
    has_more: false,
  });
});

test("rejects malformed, incomplete, reversed, or paginated time ranges", async () => {
  let queryCalled = false;
  const service = createAlertReadService({
    alertRepository: {
      async listBetween() {
        queryCalled = true;
      },
      async listPage() {
        queryCalled = true;
      },
    },
  });

  const invalidRanges = [
    [
      {
        since: "2026-10-07T00:00:00Z",
        to: "2026-10-07T12:00:00.000Z",
      },
      "since",
    ],
    [{ since: "2026-10-07T00:00:00.000Z" }, "to"],
    [{ to: "2026-10-07T12:00:00.000Z" }, "since"],
    [
      {
        since: "2026-10-07T12:00:00.000Z",
        to: "2026-10-07T00:00:00.000Z",
      },
      "since",
    ],
    [
      {
        since: "2026-10-07T00:00:00.000Z",
        to: "2026-10-07T12:00:00.000Z",
        limit: "50",
      },
      "since",
    ],
  ];
  for (const [query, field] of invalidRanges) {
    await assert.rejects(
      service.list(query),
      (error) =>
        error instanceof AlertReadValidationError &&
        error.details[0].field === field,
    );
  }
  assert.equal(queryCalled, false);
});

test("rejects invalid limits before querying the repository", async () => {
  let queryCalled = false;
  const service = createAlertReadService({
    alertRepository: {
      async listPage() {
        queryCalled = true;
      },
    },
  });

  for (const limit of ["0", "-1", "1.5", "101", "nope"]) {
    await assert.rejects(
      service.list({ limit }),
      (error) =>
        error instanceof AlertReadValidationError &&
        error.details[0].field === "limit",
    );
  }
  assert.equal(queryCalled, false);
});

test("rejects malformed cursors before querying the repository", async () => {
  let queryCalled = false;
  const service = createAlertReadService({
    alertRepository: {
      async listPage() {
        queryCalled = true;
      },
    },
  });

  for (const cursor of [
    "",
    "not-base64",
    Buffer.from("{}").toString("base64url"),
  ]) {
    await assert.rejects(
      service.list({ cursor }),
      (error) =>
        error instanceof AlertReadValidationError &&
        error.details[0].field === "cursor",
    );
  }
  assert.equal(queryCalled, false);
});
