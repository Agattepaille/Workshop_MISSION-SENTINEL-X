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

test("writes events to their own InfluxDB measurement", async () => {
  let writeArguments;
  const client = {
    async write(...args) {
      writeArguments = args;
    },
    close() {},
  };
  const repository = createAlertRepository({
    client,
    database: "alerts",
  });

  await repository.saveEvent(
    {
      timestamp: "2026-10-08T18:30:00.000Z",
      source_type: "camera",
      source_id: "CAM-ENT-03",
    },
    "2026-10-08T18:30:01.000Z",
    "event-uuid",
  );

  const [writtenPoint, database, precision, options] = writeArguments;
  assert.equal(database, "alerts");
  assert.equal(precision, undefined);
  assert.deepEqual(options, { useV2Api: false, acceptPartial: false });
  const lineProtocol = writtenPoint.toLineProtocol();
  assert.match(lineProtocol, /^events,/);
  assert.match(lineProtocol, /event_id=event-uuid/);
  assert.match(lineProtocol, /source_type=camera/);
  assert.match(lineProtocol, /source_id=CAM-ENT-03/);
  assert.match(lineProtocol, /received_at=/);
  assert.doesNotMatch(lineProtocol, /image|payload_json/);
});

test("reads the latest event or returns null when none exists", async () => {
  const eventRow = {
    time: new Date("2026-10-08T18:30:00.000Z"),
    event_id: "event-uuid",
    source_type: "camera",
    source_id: "CAM-ENT-03",
    received_at: "2026-10-08T18:30:01.000Z",
  };
  let queryText;
  let rows = [eventRow];
  const client = {
    async query(query) {
      queryText = query;
      return (async function* () {
        yield* rows;
      })();
    },
    close() {},
  };
  const repository = createAlertRepository({ client, database: "alerts" });

  assert.deepEqual(await repository.getLatestEvent(), {
    id: eventRow.event_id,
    timestamp: "2026-10-08T18:30:00.000Z",
    source_type: "camera",
    source_id: "CAM-ENT-03",
    received_at: eventRow.received_at,
  });
  assert.match(queryText, /FROM events/);
  assert.match(queryText, /ORDER BY time DESC, event_id DESC/);
  assert.match(queryText, /LIMIT 1/);

  rows = [];
  assert.equal(await repository.getLatestEvent(), null);
});

test("reads all alerts in reverse chronological order without a limit", async () => {
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

  const alerts = await repository.listAll();

  assert.equal(queryArguments[1], "alerts");
  assert.match(queryArguments[0], /ORDER BY time DESC, alert_id DESC/);
  assert.equal(queryArguments[0].includes("LIMIT"), false);
  assert.equal(alerts.length, 2);
  assert.equal(alerts[0].id, firstId);
  assert.deepEqual(alerts[0].measurements, alert.measurements);
  assert.equal(alerts[1].id, secondId);
});

test("queries and returns all alerts within a timestamp range", async () => {
  const alertId = "71a3eea1-6cdd-4af9-9aa1-bcbcc6d5268f";
  const range = {
    from: "2026-10-07T00:00:00.000Z",
    to: "2026-10-07T12:00:00.000Z",
  };
  let queryText;
  const client = {
    async query(query) {
      queryText = query;
      return (async function* () {
        yield {
          time: new Date("2026-10-07T11:00:00.000Z"),
          alert_id: alertId,
          payload_json: JSON.stringify({
            ...alert,
            timestamp: "2026-10-07T11:00:00.000Z",
          }),
          received_at: "2026-10-07T11:00:01.000Z",
        };
      })();
    },
    close() {},
  };
  const repository = createAlertRepository({ client, database: "alerts" });

  const result = await repository.listBetween(range);

  assert.match(queryText, /time >= '2026-10-07T00:00:00\.000Z'/);
  assert.match(queryText, /time <= '2026-10-07T12:00:00\.000Z'/);
  assert.match(queryText, /ORDER BY time DESC, alert_id DESC/);
  assert.equal(queryText.includes("LIMIT"), false);
  assert.deepEqual(result, [
    {
      id: alertId,
      timestamp: "2026-10-07T11:00:00.000Z",
      device_id: alert.device_id,
      measurements: alert.measurements,
      sensor_states: alert.sensor_states,
      received_at: "2026-10-07T11:00:01.000Z",
    },
  ]);
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
