import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AlertValidationError,
  createAlertService,
} from "../src/services/alert-service.js";

test("creates a saved alert using the repository without handling database details", () => {
  const alert = {
    timestamp: "2026-10-05T12:00:00.000Z",
    device_id: "esp8266-demo",
    measurements: { temperature_c: 21.4 },
    sensor_states: { motion: false },
  };
  let savedAlert;
  const service = createAlertService({
    alertRepository: {
      save(alertToSave, receivedAt) {
        savedAlert = { alert: alertToSave, receivedAt };
        return 42;
      },
    },
  });

  const result = service.create(alert);

  assert.deepEqual(savedAlert.alert, alert);
  assert.equal(Number.isNaN(Date.parse(savedAlert.receivedAt)), false);
  assert.deepEqual(result, {
    id: 42,
    ...alert,
    received_at: savedAlert.receivedAt,
  });
});

test("validates alert business rules before asking the repository to save", () => {
  let saveCalled = false;
  const service = createAlertService({
    alertRepository: {
      save() {
        saveCalled = true;
      },
    },
  });

  assert.throws(
    () =>
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
