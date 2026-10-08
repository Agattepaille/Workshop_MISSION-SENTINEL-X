import { Point } from "@influxdata/influxdb3-client";
import { createInfluxConnection } from "./influx-client.js";

function quoteSqlString(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

async function collectRows(queryResult) {
  const rows = [];
  for await (const row of queryResult) {
    rows.push(row);
  }
  return rows;
}

function deserializeAlert(row) {
  return {
    id: row.alert_id,
    ...JSON.parse(row.payload_json),
    received_at: row.received_at,
  };
}

function deserializeEvent(row) {
  return {
    id: row.event_id,
    timestamp: new Date(row.time).toISOString(),
    source_type: row.source_type,
    source_id: row.source_id,
    received_at: row.received_at,
  };
}

export function createAlertRepository({ client, database } = {}) {
  const connection =
    client && database ? { client, database } : createInfluxConnection();
  const influxClient = connection.client;
  const influxDatabase = connection.database;

  return {
    async save(alert, receivedAt, id) {
      const point = Point.measurement("alerts")
        .setTag("alert_id", id)
        .setTag("device_id", alert.device_id)
        .setStringField("payload_json", JSON.stringify(alert))
        .setStringField("received_at", receivedAt)
        .setTimestamp(new Date(alert.timestamp));

      for (const [name, value] of Object.entries(alert.measurements)) {
        point.setFloatField(`measurement_${name}`, value);
      }

      await influxClient.write(point, influxDatabase, undefined, {
        useV2Api: false,
        acceptPartial: false,
      });
    },

    async saveEvent(event, receivedAt, id) {
      const point = Point.measurement("events")
        .setTag("event_id", id)
        .setTag("source_type", event.source_type)
        .setTag("source_id", event.source_id)
        .setStringField("received_at", receivedAt)
        .setTimestamp(new Date(event.timestamp));

      await influxClient.write(point, influxDatabase, undefined, {
        useV2Api: false,
        acceptPartial: false,
      });
    },

    async getLatestEvent() {
      const query = `
        SELECT time, event_id, source_type, source_id, received_at
        FROM events
        ORDER BY time DESC, event_id DESC
        LIMIT 1
      `;
      const rows = await collectRows(
        await influxClient.query(query, influxDatabase),
      );
      return rows.length > 0 ? deserializeEvent(rows[0]) : null;
    },

    async listAll() {
      const query = `
        SELECT time, alert_id, payload_json, received_at
        FROM alerts
        ORDER BY time DESC, alert_id DESC
      `;
      const rows = await collectRows(
        await influxClient.query(query, influxDatabase),
      );
      return rows.map(deserializeAlert);
    },

    async listBetween({ from, to }) {
      const query = `
        SELECT time, alert_id, payload_json, received_at
        FROM alerts
        WHERE time >= ${quoteSqlString(from)} AND time <= ${quoteSqlString(to)}
        ORDER BY time DESC, alert_id DESC
      `;
      const rows = await collectRows(
        await influxClient.query(query, influxDatabase),
      );
      return rows.map(deserializeAlert);
    },

    async close() {
      await influxClient.close();
    },
  };
}
