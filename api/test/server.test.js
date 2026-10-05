import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import Database from "better-sqlite3";
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
let directory;
let databasePath;
let baseUrl;
let websocketUrl;
let sockets;

beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), "sentinel-x-api-"));
  databasePath = join(directory, "alerts.sqlite");
  app = createAlertServer({ databasePath });
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
  rmSync(directory, { recursive: true, force: true });
});

async function connectWebSocket() {
  const socket = new WebSocket(websocketUrl);
  sockets.push(socket);
  await once(socket, "open");
  return socket;
}

function storedAlertCount() {
  const database = new Database(databasePath, { readonly: true });
  try {
    return database.prepare("SELECT COUNT(*) AS count FROM alerts").get().count;
  } finally {
    database.close();
  }
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
  assert.equal(notification.data.measurements.temperature_c, 21.4);
  assert.equal(storedAlertCount(), 1);
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
  assert.equal(storedAlertCount(), 0);
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

  assert.equal(storedAlertCount(), 0);
});

test("exposes only POST on the alert route", async () => {
  const response = await fetch(`${baseUrl}/api/v1/alerts`);
  const responseBody = await response.json();

  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "POST");
  assert.equal(responseBody.error.code, "method_not_allowed");
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
