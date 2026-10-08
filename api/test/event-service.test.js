import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createEventService,
  EventValidationError,
} from "../src/services/event-service.js";

const event = {
  timestamp: "2026-10-08T18:30:00.000Z",
  source_type: "camera",
  source_id: "CAM-ENT-03",
};

test("creates a saved event with an API-generated ID and receipt timestamp", async () => {
  let savedEvent;
  const service = createEventService({
    eventRepository: {
      async saveEvent(value, receivedAt, id) {
        savedEvent = { value, receivedAt, id };
      },
    },
  });

  const result = await service.create(event);

  assert.deepEqual(savedEvent.value, event);
  assert.equal(Number.isNaN(Date.parse(savedEvent.receivedAt)), false);
  assert.equal(savedEvent.id, result.id);
  assert.match(result.id, /^[0-9a-f-]{36}$/);
  assert.deepEqual(result, {
    id: savedEvent.id,
    ...event,
    received_at: savedEvent.receivedAt,
  });
});

test("rejects invalid event fields before saving", async () => {
  let saveCalled = false;
  const service = createEventService({
    eventRepository: {
      async saveEvent() {
        saveCalled = true;
      },
    },
  });

  await assert.rejects(
    service.create({
      ...event,
      timestamp: "not-a-timestamp",
      source_type: "sensor",
      image: "not-allowed",
    }),
    (error) => {
      assert.ok(error instanceof EventValidationError);
      assert.ok(error.details.some((detail) => detail.field === "timestamp"));
      assert.ok(error.details.some((detail) => detail.field === "source_type"));
      assert.ok(error.details.some((detail) => detail.field === "image"));
      return true;
    },
  );
  assert.equal(saveCalled, false);
});

test("returns the latest persisted event", async () => {
  const latestEvent = { id: "event-id", ...event };
  const service = createEventService({
    eventRepository: {
      async getLatestEvent() {
        return latestEvent;
      },
    },
  });

  assert.equal(await service.latest(), latestEvent);
});
