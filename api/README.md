# SENTINEL-X API (prototype)

Prototype Node.js REST API with InfluxDB 3 Core persistence and a WebSocket event stream.
The REST API accepts alerts at `POST /api/v1/alerts` and lists them at
`GET /api/v1/alerts`.

## Architecture

`src/services/alert-write-service.js` validates and creates alerts;
`src/services/alert-read-service.js` validates pagination input and lists
alerts. Their `createAlertWriteService` and `createAlertReadService` factories
receive the repository as a dependency, keeping persistence details out of the
services and allowing tests to inject a fake repository. The HTTP server
handles transport concerns and delegates to the appropriate service.
InfluxDB connection settings and client APIs are isolated in
`src/persistence/influx-client.js`; alert points are written and queried by
`src/persistence/alert-repository.influx.js`.
The point layout is documented in [INFLUXDB_SCHEMA.md](INFLUXDB_SCHEMA.md).
`createAlertServer` accepts an `alertRepository` option for injecting another
implementation, which lets tests run without an InfluxDB server.

## Requirements

- Node.js 20 or later
- npm
- InfluxDB 3 Core running locally or reachable over HTTP

## Start locally

Run all commands in this README from the `api/` directory:

```sh
cd api
npm install
cp .env.example .env
# Set your InfluxDB token in .env
npm start
```

The API uses the InfluxDB 3 JavaScript client and writes with the native v3
write endpoint. `INFLUX_HOST` defaults to `http://127.0.0.1:8181`, the default
HTTP address for InfluxDB 3 Core. Provide an operator token in `INFLUX_TOKEN`
and an existing database name in `INFLUX_DATABASE`. For a local instance, the
InfluxDB CLI can create a database with
`influxdb3 create database alerts --token '<your-token>'`. Create an operator
token with `influxdb3 create token --admin` if the instance does not already
have one. Tokens should be kept out of source control.

The API loads `.env` automatically at startup. Set `INFLUX_TOKEN` in `.env`
before starting it; the template in `.env.example` lists the supported names.
Variables already exported in the environment take precedence over values in
`.env`.

By default, the API listens on `http://127.0.0.1:3000`, accepts alerts at
`POST /api/v1/alerts`, and stores each alert as a point in the configured
InfluxDB 3 database. Its point timestamp is the alert timestamp; `device_id` and a
generated UUID are tags, numeric measurements are written as
`measurement_<name>` fields, and `payload_json` preserves the complete alert.
The API waits for InfluxDB to flush each accepted alert before returning
success. WebSocket clients can connect to `ws://127.0.0.1:3000/ws` to receive
accepted alerts.

Set `PORT` or `HOST` to override the server defaults. For example,
`HOST=0.0.0.0` makes the server reachable on the local network; do this only on
a trusted network because authentication is not implemented yet.

## Alert contract

### List alerts

`GET /api/v1/alerts` returns alerts in reverse chronological order. It uses
cursor pagination so clients can walk through the history without offset-based
pages shifting as new alerts arrive.

- `limit`: optional page size; defaults to `50` and must be between `1` and
  `100`.
- `cursor`: optional opaque cursor returned by the previous page.

The response contains a `data` array and pagination metadata. When
`has_more` is `true`, send `next_cursor` to retrieve the next page:

```sh
curl -i 'http://127.0.0.1:3000/api/v1/alerts?limit=50'
curl -i 'http://127.0.0.1:3000/api/v1/alerts?limit=50&cursor=<next_cursor>'
```

The response shape is:

```json
{
  "data": [
    {
      "id": "71a3eea1-6cdd-4af9-9aa1-bcbcc6d5268f",
      "timestamp": "2026-10-05T12:00:00.000Z",
      "device_id": "esp8266-demo",
      "measurements": { "temperature_c": 21.4 },
      "sensor_states": { "motion": false },
      "received_at": "2026-10-05T12:00:01.000Z"
    }
  ],
  "pagination": {
    "next_cursor": "<opaque cursor or null>",
    "has_more": false
  }
}
```

Invalid query parameters return `400` with the standard API error shape.

### Create alerts

The request body must be JSON with:

- `timestamp`: required RFC 3339 timestamp with timezone
- `device_id`: required non-empty string, maximum 128 characters
- `measurements`: optional object whose values are finite numbers
- `sensor_states`: optional object whose values are booleans or short strings

Unknown top-level fields are rejected. Measurement and sensor-state names must
be 1-64 characters. Request bodies are limited to 16 KiB.

Example:

```sh
curl -i http://127.0.0.1:3000/api/v1/alerts \
  -H 'content-type: application/json' \
  -d '{
    "timestamp": "2026-10-05T12:00:00Z",
    "device_id": "esp8266-demo",
    "measurements": {
      "temperature_c": 21.4,
      "humidity_pct": 55
    },
    "sensor_states": {
      "temperature": "ok",
      "motion": false
    }
  }'
```

A successful request returns HTTP `201` with the saved alert, including its
UUID `id` and server-side `received_at` timestamp. Invalid JSON returns
`400`; invalid fields return `422`; unsupported content types return `415`;
oversized bodies return `413`. Errors use the shape
`{"error":{"code":"...","message":"...","details":[]}}` (details are present
for validation errors).

Each accepted alert is broadcast to connected WebSocket clients as:

```json
{
  "type": "alert.created",
  "data": {
    "id": 1,
    "timestamp": "2026-10-05T12:00:00.000Z",
    "device_id": "esp8266-demo",
    "measurements": { "temperature_c": 21.4, "humidity_pct": 55 },
    "sensor_states": { "temperature": "ok", "motion": false },
    "received_at": "2026-10-05T12:00:01.000Z"
  }
}
```

This prototype binds to localhost by default and does not implement client
authentication or TLS. Before exposing it beyond a trusted local network, add
authentication and configure HTTPS/WSS at the deployment or reverse-proxy
layer; the application does not claim to provide encryption itself.

## Tests

```sh
npm test
```

## Send sample alerts

Start the server in one terminal, then send the five valid sample alerts from
`test/fixtures/alerts.json` in another:

```sh
npm run send:alerts
```

The script posts each alert to `http://127.0.0.1:3000/api/v1/alerts` and prints
the ID returned by the API. Set `API_BASE_URL` to target another server:

```sh
API_BASE_URL=http://127.0.0.1:3001 npm run send:alerts
```

To inspect saved rows with the InfluxDB 3 CLI, run:

```sh
influxdb3 query \
  --database alerts \
  --token '<your-influxdb3-token>' \
  'SELECT * FROM alerts ORDER BY time DESC LIMIT 10'
```
