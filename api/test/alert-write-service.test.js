import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AlertValidationError,
  createAlertWriteService,
} from "../src/services/alert-write-service.js";

test("creates a saved alert using the repository without handling database details", async () => {
  const alert = {
    timestamp: "2026-10-05T12:00:00.000Z",
    device_id: "esp8266-demo",
    measurements: { temperature_c: 21.4 },
    sensor_states: { motion: false },
  };
  let savedAlert;
  const service = createAlertWriteService({
    alertRepository: {
      async save(alertToSave, receivedAt, id) {
        savedAlert = { alert: alertToSave, receivedAt, id };
      },
    },
  });

  const result = await service.create(alert);

  assert.deepEqual(savedAlert.alert, alert);
  assert.equal(Number.isNaN(Date.parse(savedAlert.receivedAt)), false);
  assert.equal(savedAlert.id, result.id);
  assert.match(result.id, /^[0-9a-f-]{36}$/);
  assert.deepEqual(result, {
    id: savedAlert.id,
    ...alert,
    received_at: savedAlert.receivedAt,
  });
});

test("validates alert business rules before asking the repository to save", async () => {
  let saveCalled = false;
  const service = createAlertWriteService({
    alertRepository: {
      save() {
        saveCalled = true;
      },
    },
  });

  await assert.rejects(
    service.create({
      device_id: "esp8266-demo",
      measurements: { temperature_c: "warm" },
    }),
    (error) => {
      assert.ok(error instanceof AlertValidationError);
      assert.equal(error.message, "Alert contains invalid fields.");
      assert.ok(error.details.some((detail) => detail.field === "timestamp"));
      assert.ok(
        error.details.some(
          (detail) => detail.field === "measurements.temperature_c",
        ),
      );
      return true;
    },
  );
  assert.equal(saveCalled, false);
});
