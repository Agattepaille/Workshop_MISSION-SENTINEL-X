import { Point } from "@influxdata/influxdb3-client";
import { createInfluxConnection } from "./influx-client.js";

function quoteSqlString(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function normalizeTimestamp(value) {
  const timestamp = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(timestamp.getTime())) {
    throw new Error("InfluxDB returned an invalid alert timestamp.");
  }
  return timestamp.toISOString();
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

    async listPage({ limit, cursor }) {
      const cursorFilter = cursor
        ? `WHERE (time < ${quoteSqlString(cursor.timestamp)} OR (time = ${quoteSqlString(cursor.timestamp)} AND alert_id < ${quoteSqlString(cursor.alertId)}))`
        : "";
      const query = `
        SELECT time, alert_id, payload_json, received_at
        FROM alerts
        ${cursorFilter}
        ORDER BY time DESC, alert_id DESC
        LIMIT ${limit + 1}
      `;
      const queryResult = await influxClient.query(query, influxDatabase);
      const rows = [];
      for await (const row of queryResult) {
        rows.push(row);
      }

      const hasMore = rows.length > limit;
      if (hasMore) rows.pop();

      const data = rows.map((row) => ({
        id: row.alert_id,
        ...JSON.parse(row.payload_json),
        received_at: row.received_at,
      }));
      const lastRow = rows.at(-1);

      return {
        data,
        hasMore,
        nextCursor:
          hasMore && lastRow
            ? {
                timestamp: normalizeTimestamp(lastRow.time),
                alertId: lastRow.alert_id,
              }
            : null,
      };
    },

    async close() {
      await influxClient.close();
    },
  };
}
