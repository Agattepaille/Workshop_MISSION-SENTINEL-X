import assert from "node:assert/strict";
import { test } from "node:test";
import { createMqttCommandClient } from "../src/mqtt-command-client.js";

test("disables command delivery explicitly when no MQTT URL is configured", async () => {
  const client = createMqttCommandClient({ url: "" });

  assert.equal(client.configured, false);
  assert.equal(client.connected, false);
  assert.equal(client.getDeviceStatus("esp8266-demo"), null);
  await assert.rejects(
    client.publishCommand({
      deviceId: "esp8266-demo",
      payload: { action: "leds.auto" },
    }),
    /MQTT_URL is not configured/,
  );
  await client.close();
});
