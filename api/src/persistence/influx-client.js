import { InfluxDBClient } from "@influxdata/influxdb3-client";

export function createInfluxConnection({
  host = process.env.INFLUX_HOST ?? "http://127.0.0.1:8181",
  token = process.env.INFLUX_TOKEN,
  database = process.env.INFLUX_DATABASE,
} = {}) {
  const config = {
    INFLUX_HOST: host,
    INFLUX_TOKEN: token,
    INFLUX_DATABASE: database,
  };
  const missing = Object.entries(config)
    .filter(([, value]) => typeof value !== "string" || value.trim() === "")
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(
      `Missing required InfluxDB configuration: ${missing.join(", ")}.`,
    );
  }

  const client = new InfluxDBClient({ host, token, database });

  return { client, database };
}
