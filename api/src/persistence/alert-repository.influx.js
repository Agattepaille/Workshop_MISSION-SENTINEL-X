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
