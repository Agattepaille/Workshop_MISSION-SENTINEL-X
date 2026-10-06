import assert from "node:assert/strict";
import { once } from "node:events";
import { afterEach, beforeEach, test } from "node:test";
import WebSocket from "ws";
import { createAlertServer } from "../src/server.js";

const sampleAlert = {
  timestamp: "2026-10-05T12:00:00Z",
  device_id: "esp8266-demo",
  measurements: {
    temperature_c: 21.4,
    humidity_pct: 55,
  },
  sensor_states: {
    temperature: "ok",
    motion: false,
  },
};

let app;
let baseUrl;
let websocketUrl;
let sockets;
let storedAlerts;
let repositoryPageRequest;

beforeEach(async () => {
  storedAlerts = new Map();
  repositoryPageRequest = undefined;
  app = createAlertServer({
    alertRepository: {
      async save(alert, receivedAt, id) {
        storedAlerts.set(id, {
          id,
          ...alert,
          received_at: receivedAt,
        });
      },
      async listPage(pageRequest) {
        repositoryPageRequest = pageRequest;
        return {
          data: [...storedAlerts.values()].slice(0, pageRequest.limit),
          hasMore: false,
          nextCursor: null,
        };
      },
      async close() {},
    },
  });
  sockets = [];
  await new Promise((resolveListen) =>
    app.server.listen(0, "127.0.0.1", resolveListen),
  );
  const address = app.server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
  websocketUrl = `ws://127.0.0.1:${address.port}/ws`;
});

afterEach(async () => {
  for (const socket of sockets) socket.terminate();
  await app.close();
});

async function connectWebSocket() {
  const socket = new WebSocket(websocketUrl);
  sockets.push(socket);
  await once(socket, "open");
  return socket;
}

test("persists accepted alerts and broadcasts them over WebSocket", async () => {
  const socket = await connectWebSocket();
  const notificationPromise = once(socket, "message");
  const response = await fetch(`${baseUrl}/api/v1/alerts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(sampleAlert),
  });
  const responseBody = await response.json();
  const [message] = await notificationPromise;
  const notification = JSON.parse(message.toString());

  assert.equal(response.status, 201);
  assert.equal(responseBody.data.device_id, sampleAlert.device_id);
  assert.equal(responseBody.data.timestamp, "2026-10-05T12:00:00.000Z");
  assert.equal(notification.type, "alert.created");
  assert.equal(notification.data.id, responseBody.data.id);
  assert.match(responseBody.data.id, /^[0-9a-f-]{36}$/);
  assert.equal(notification.data.measurements.temperature_c, 21.4);
  assert.equal(storedAlerts.size, 1);
});

test("rejects invalid alerts without storing or broadcasting them", async () => {
  const socket = await connectWebSocket();
  const response = await fetch(`${baseUrl}/api/v1/alerts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...sampleAlert,
      measurements: { temperature_c: "warm" },
    }),
  });
  const responseBody = await response.json();

  assert.equal(response.status, 422);
  assert.equal(responseBody.error.code, "validation_failed");
  assert.equal(storedAlerts.size, 0);
  assert.equal(socket.readyState, WebSocket.OPEN);
});

test("rejects null measurement and sensor-state objects", async () => {
  for (const field of ["measurements", "sensor_states"]) {
    const response = await fetch(`${baseUrl}/api/v1/alerts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...sampleAlert, [field]: null }),
    });

    assert.equal(response.status, 422, `${field} must not be null`);
  }

  assert.equal(storedAlerts.size, 0);
});

test("returns an error and does not broadcast when persistence fails", async () => {
  await app.close();
  app = createAlertServer({
    alertRepository: {
      async save() {
        throw new Error("InfluxDB unavailable");
      },
      async close() {},
    },
  });
  await new Promise((resolveListen) =>
    app.server.listen(0, "127.0.0.1", resolveListen),
  );
  const address = app.server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;

  const response = await fetch(`${baseUrl}/api/v1/alerts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(sampleAlert),
  });

  assert.equal(response.status, 500);
  assert.equal((await response.json()).error.code, "internal_error");
});

test("reads alerts with cursor-pagination metadata", async () => {
  const createResponse = await fetch(`${baseUrl}/api/v1/alerts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(sampleAlert),
  });
  const createdAlert = (await createResponse.json()).data;

  const response = await fetch(`${baseUrl}/api/v1/alerts?limit=10`);
  const responseBody = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(responseBody.data, [createdAlert]);
  assert.deepEqual(responseBody.pagination, {
    next_cursor: null,
    has_more: false,
  });
  assert.deepEqual(repositoryPageRequest, { limit: 10, cursor: undefined });
});

test("rejects invalid alert-list query parameters", async () => {
  for (const query of [
    "limit=101",
    "limit=1&limit=2",
    "cursor=invalid",
    "unexpected=true",
  ]) {
    const response = await fetch(`${baseUrl}/api/v1/alerts?${query}`);
    const responseBody = await response.json();

    assert.equal(response.status, 400, query);
    assert.equal(responseBody.error.code, "invalid_query", query);
  }
  assert.equal(repositoryPageRequest, undefined);
});

test("rejects unsupported methods while allowing GET and POST", async () => {
  const response = await fetch(`${baseUrl}/api/v1/alerts`, {
    method: "PUT",
  });
  const responseBody = await response.json();

  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "GET, POST");
  assert.equal(responseBody.error.code, "method_not_allowed");
  assert.equal(responseBody.error.message, "Use GET or POST for this route.");
});

test("returns explicit errors for unsupported media type and malformed JSON", async () => {
  const wrongMediaType = await fetch(`${baseUrl}/api/v1/alerts`, {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: "{}",
  });
  const malformedJson = await fetch(`${baseUrl}/api/v1/alerts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  });

  assert.equal(wrongMediaType.status, 415);
  assert.equal(
    (await wrongMediaType.json()).error.code,
    "unsupported_media_type",
  );
  assert.equal(malformedJson.status, 400);
  assert.equal((await malformedJson.json()).error.code, "invalid_json");
});
