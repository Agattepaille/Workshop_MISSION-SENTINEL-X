import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import mqtt from "mqtt";

const COMMAND_RESULTS_TOPIC = "sentinel-x/devices/+/command-results";
const DEVICE_STATUS_TOPIC = "sentinel-x/devices/+/status";
const DEVICE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

function parseJson(buffer, topic) {
  try {
    return JSON.parse(buffer.toString("utf8"));
  } catch (error) {
    console.error(
      `Ignoring invalid JSON received on MQTT topic ${topic}:`,
      error,
    );
    return null;
  }
}

export function createMqttCommandClient({
  url = process.env.MQTT_URL,
  username = process.env.MQTT_USERNAME,
  password = process.env.MQTT_PASSWORD,
  clientId = process.env.MQTT_CLIENT_ID ?? `sentinel-x-api-${randomUUID()}`,
} = {}) {
  const events = new EventEmitter();
  const deviceStatuses = new Map();
  const configured = typeof url === "string" && url.trim().length > 0;
  let client;
  let connected = false;
  let subscriptionsReady = false;

  if (configured) {
    client = mqtt.connect(url, {
      clientId,
      ...(username ? { username } : {}),
      ...(password ? { password } : {}),
      connectTimeout: 5000,
      reconnectPeriod: 1000,
    });

    client.on("connect", () => {
      connected = true;
      subscriptionsReady = false;
      client.subscribe(
        [
          { topic: COMMAND_RESULTS_TOPIC, qos: 1 },
          { topic: DEVICE_STATUS_TOPIC, qos: 1 },
        ],
        (error) => {
          if (error) {
            console.error("Failed to subscribe to MQTT command topics:", error);
            events.emit("broker-status", {
              connected,
              subscriptionsReady: false,
            });
            return;
          }
          subscriptionsReady = true;
          events.emit("broker-status", { connected, subscriptionsReady });
        },
      );
      events.emit("broker-status", { connected, subscriptionsReady });
    });

    for (const eventName of ["reconnect", "offline", "close"]) {
      client.on(eventName, () => {
        connected = false;
        subscriptionsReady = false;
        events.emit("broker-status", { connected, subscriptionsReady });
      });
    }

    client.on("error", (error) => {
      connected = false;
      subscriptionsReady = false;
      console.error("MQTT client error:", error);
      events.emit("broker-status", {
        connected,
        subscriptionsReady,
        error: error.message,
      });
    });

    client.on("message", (topic, message) => {
      const parts = topic.split("/");
      const deviceId = parts[2];
      if (!DEVICE_ID_PATTERN.test(deviceId ?? "")) {
        console.error(
          `Ignoring MQTT message with invalid device topic: ${topic}`,
        );
        return;
      }

      const payload = parseJson(message, topic);
      if (payload === null) return;

      if (parts[3] === "command-results") {
        events.emit("command-result", { deviceId, payload });
        return;
      }

      if (
        parts[3] === "status" &&
        payload !== null &&
        typeof payload === "object" &&
        !Array.isArray(payload) &&
        typeof payload.online === "boolean"
      ) {
        const status = {
          online: payload.online,
          received_at: new Date().toISOString(),
        };
        deviceStatuses.set(deviceId, status);
        events.emit("device-status", { deviceId, ...status });
        return;
      }

      console.error(`Ignoring invalid MQTT status received on ${topic}.`);
    });
  }

  return {
    get connected() {
      return connected;
    },

    get configured() {
      return configured;
    },

    on(eventName, listener) {
      events.on(eventName, listener);
    },

    off(eventName, listener) {
      events.off(eventName, listener);
    },

    publishCommand({ deviceId, payload }) {
      if (!configured) {
        return Promise.reject(
          new Error(
            "MQTT_URL is not configured; command delivery is disabled.",
          ),
        );
      }
      if (!connected) {
        return Promise.reject(new Error("The MQTT broker is not connected."));
      }
      if (!subscriptionsReady) {
        return Promise.reject(
          new Error("MQTT command result subscriptions are not ready."),
        );
      }

      return new Promise((resolve, reject) => {
        client.publish(
          `sentinel-x/devices/${deviceId}/commands`,
          JSON.stringify(payload),
          { qos: 1, retain: false },
          (error) => (error ? reject(error) : resolve()),
        );
      });
    },

    getDeviceStatus(deviceId) {
      return deviceStatuses.get(deviceId) ?? null;
    },

    close() {
      if (!client) return Promise.resolve();
      connected = false;
      subscriptionsReady = false;
      return new Promise((resolve, reject) => {
        client.end(false, {}, (error) => (error ? reject(error) : resolve()));
      });
    },
  };
}
