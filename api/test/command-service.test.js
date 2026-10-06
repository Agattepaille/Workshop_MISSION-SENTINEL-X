import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { test } from "node:test";
import {
  CommandDispatchError,
  CommandValidationError,
  createCommandService,
} from "../src/services/command-service.js";

function createMqttClient() {
  const client = new EventEmitter();
  client.published = [];
  client.publishCommand = async (command) => {
    client.published.push(command);
  };
  return client;
}

test("publishes an allow-listed buzzer command with a fixed five-second duration", async () => {
  const mqttClient = createMqttClient();
  const service = createCommandService({
    mqttCommandClient: mqttClient,
    ackTimeoutMs: 100,
  });

  const command = await service.create({
    device_id: "esp8266-demo",
    action: "buzzer.trigger",
  });

  assert.match(command.command_id, /^[0-9a-f-]{36}$/);
  assert.equal(command.status, "pending");
  assert.equal(mqttClient.published[0].payload.duration_ms, 5000);
  assert.equal(mqttClient.published[0].payload.command_id, command.command_id);
  assert.equal("timeout" in command, false);
  service.close();
});

test("rejects unknown fields and unsupported actions before publishing", async () => {
  const mqttClient = createMqttClient();
  const service = createCommandService({ mqttCommandClient: mqttClient });

  await assert.rejects(
    service.create({
      device_id: "esp8266-demo",
      action: "buzzer.trigger",
      duration_ms: 60_000,
    }),
    (error) => {
      assert.ok(error instanceof CommandValidationError);
      assert.ok(error.details.some((detail) => detail.field === "duration_ms"));
      return true;
    },
  );
  await assert.rejects(
    service.create({
      device_id: "../other-device",
      action: "relay.open",
    }),
    CommandValidationError,
  );
  assert.equal(mqttClient.published.length, 0);
  service.close();
});

test("tracks a matching device acknowledgement and rejects a mismatched device", async () => {
  const mqttClient = createMqttClient();
  const service = createCommandService({
    mqttCommandClient: mqttClient,
    ackTimeoutMs: 100,
  });
  const command = await service.create({
    device_id: "esp8266-demo",
    action: "leds.test",
  });
  const updatePromise = new Promise((resolve) =>
    service.on("updated", resolve),
  );

  mqttClient.emit("command-result", null);
  mqttClient.emit("command-result", {
    deviceId: "another-device",
    payload: { command_id: command.command_id, status: "completed" },
  });
  assert.equal(service.get(command.command_id).status, "pending");

  mqttClient.emit("command-result", {
    deviceId: "esp8266-demo",
    payload: { command_id: command.command_id, status: "completed" },
  });
  const updated = await updatePromise;

  assert.equal(updated.status, "completed");
  assert.equal(service.get(command.command_id).status, "completed");
  service.close();
});

test("marks a command unconfirmed when no device acknowledgement arrives", async () => {
  const mqttClient = createMqttClient();
  const service = createCommandService({
    mqttCommandClient: mqttClient,
    ackTimeoutMs: 10,
  });
  const command = await service.create({
    device_id: "esp8266-demo",
    action: "leds.auto",
  });
  const updatePromise = new Promise((resolve) =>
    service.on("updated", resolve),
  );
  const updated = await updatePromise;

  assert.equal(updated.command_id, command.command_id);
  assert.equal(updated.status, "unconfirmed");
  service.close();
});

test("reports broker publication failures as dispatch errors", async () => {
  const mqttClient = createMqttClient();
  mqttClient.publishCommand = async () => {
    throw new Error("broker offline");
  };
  const service = createCommandService({ mqttCommandClient: mqttClient });

  await assert.rejects(
    service.create({
      device_id: "esp8266-demo",
      action: "leds.auto",
    }),
    (error) => {
      assert.ok(error instanceof CommandDispatchError);
      assert.equal(error.message, "broker offline");
      return true;
    },
  );
  service.close();
});
