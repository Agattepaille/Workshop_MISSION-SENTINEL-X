import assert from "node:assert/strict";
import { test } from "node:test";
import { createAlertRepository } from "../src/persistence/alert-repository.influx.js";
import { createInfluxConnection } from "../src/persistence/influx-client.js";

const alert = {
  timestamp: "2026-10-05T12:00:00.000Z",
  device_id: "esp8266-demo",
  measurements: { temperature_c: 21.4 },
  sensor_states: { motion: false },
};

test("writes an alert with the InfluxDB 3 API and closes the client", async () => {
  let writeArguments;
  let closed = false;
  const client = {
    async write(...args) {
      writeArguments = args;
    },
    close() {
      closed = true;
    },
  };
  const repository = createAlertRepository({
    client,
    database: "alerts",
  });

  await repository.save(alert, "2026-10-05T12:00:01.000Z", "alert-uuid");

  const [writtenPoint, database, precision, options] = writeArguments;
  assert.equal(database, "alerts");
  assert.equal(precision, undefined);
  assert.deepEqual(options, { useV2Api: false, acceptPartial: false });
  const lineProtocol = writtenPoint.toLineProtocol();
  assert.match(lineProtocol, /^alerts,/);
  assert.match(lineProtocol, /alert_id=alert-uuid/);
  assert.match(lineProtocol, /device_id=esp8266-demo/);
  assert.match(lineProtocol, /measurement_temperature_c=21\.4/);
  assert.match(lineProtocol, /payload_json=/);
  assert.match(lineProtocol, /received_at=/);

  await repository.close();
  assert.equal(closed, true);
});

test("reads a bounded alert page and builds its cursor from the last returned row", async () => {
  const firstId = "71a3eea1-6cdd-4af9-9aa1-bcbcc6d5268f";
  const secondId = "81a3eea1-6cdd-4af9-9aa1-bcbcc6d5268f";
  let queryArguments;
  const client = {
    async query(...args) {
      queryArguments = args;
      return (async function* () {
        yield {
          time: new Date("2026-10-05T12:00:00.000Z"),
          alert_id: firstId,
          payload_json: JSON.stringify(alert),
          received_at: "2026-10-05T12:00:01.000Z",
        };
        yield {
          time: new Date("2026-10-05T11:59:00.000Z"),
          alert_id: secondId,
          payload_json: JSON.stringify({
            ...alert,
            timestamp: "2026-10-05T11:59:00.000Z",
          }),
          received_at: "2026-10-05T11:59:01.000Z",
        };
      })();
    },
    close() {},
  };
  const repository = createAlertRepository({ client, database: "alerts" });

  const page = await repository.listPage({ limit: 1 });

  assert.equal(queryArguments[1], "alerts");
  assert.match(queryArguments[0], /ORDER BY time DESC, alert_id DESC/);
  assert.match(queryArguments[0], /LIMIT 2/);
  assert.equal(page.data.length, 1);
  assert.equal(page.data[0].id, firstId);
  assert.deepEqual(page.data[0].measurements, alert.measurements);
  assert.equal(page.hasMore, true);
  assert.deepEqual(page.nextCursor, {
    timestamp: alert.timestamp,
    alertId: firstId,
  });
});

test("uses the time-and-ID cursor to continue an alert page", async () => {
  const cursor = {
    timestamp: "2026-10-05T12:00:00.000Z",
    alertId: "71a3eea1-6cdd-4af9-9aa1-bcbcc6d5268f",
  };
  let queryText;
  const client = {
    async query(query) {
      queryText = query;
      return (async function* () {})();
    },
    close() {},
  };
  const repository = createAlertRepository({ client, database: "alerts" });

  const page = await repository.listPage({ limit: 50, cursor });

  assert.match(queryText, /time < '2026-10-05T12:00:00\.000Z'/);
  assert.match(queryText, /alert_id < '71a3eea1-6cdd-4af9-9aa1-bcbcc6d5268f'/);
  assert.deepEqual(page, { data: [], hasMore: false, nextCursor: null });
});

test("reports all missing required environment settings", () => {
  assert.throws(
    () =>
      createInfluxConnection({
        host: "",
        token: undefined,
        database: " ",
      }),
    {
      message:
        "Missing required InfluxDB configuration: INFLUX_HOST, INFLUX_TOKEN, INFLUX_DATABASE.",
    },
  );
});

test("defaults to the local InfluxDB 3 Core HTTP endpoint", () => {
  const connection = createInfluxConnection({
    token: "test-token",
    database: "alerts",
  });

  assert.equal(connection.database, "alerts");
  assert.equal(typeof connection.client.write, "function");
  connection.client.close();
});
