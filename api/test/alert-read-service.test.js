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

test("lists all alerts without pagination metadata", async () => {
  let repositoryCalled = false;
  const service = createAlertReadService({
    alertRepository: {
      async listAll() {
        repositoryCalled = true;
        return [alert];
      },
    },
  });

  const result = await service.list();

  assert.equal(repositoryCalled, true);
  assert.deepEqual(result, { data: [alert] });
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
  assert.deepEqual(result, { data: [alert] });
});

test("rejects malformed, incomplete, or reversed time ranges", async () => {
  let queryCalled = false;
  const service = createAlertReadService({
    alertRepository: {
      async listAll() {
        queryCalled = true;
      },
      async listBetween() {
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
