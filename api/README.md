# SENTINEL-X API (prototype)

Prototype Node.js REST API with SQLite persistence and a WebSocket event stream.
The initial scope is intentionally limited to one REST endpoint:
`POST /api/v1/alerts`.

## Architecture

Alert creation and validation are handled by `src/services/alert-service.js`:
the HTTP server is responsible for transport concerns, while the service applies
the alert rules, assigns a reception timestamp, and shapes the saved alert.
The service depends on a repository contract (`save` and `close`), not on SQL
or a database driver. SQL statements, schema creation, and SQLite access are
isolated in `src/persistence/alert-repository.sqlite.js`.
`createAlertServer` accepts an `alertRepository` option for injecting another
implementation. The default adapter continues to use `DATABASE_PATH` (or
`.data/sentinel-x.sqlite`).

## Requirements

- Node.js 20 or later
- npm

## Start locally

Run all commands in this README from the `api/` directory:

```sh
cd api
npm install
npm start
```

Relative paths such as `.data/sentinel-x.sqlite` are resolved from `api/`.

By default, the API listens on `http://127.0.0.1:3000`, accepts alerts at
`POST /api/v1/alerts`, and stores them in `.data/sentinel-x.sqlite`. WebSocket
clients can connect to `ws://127.0.0.1:3000/ws` to receive accepted alerts.

Set `PORT`, `HOST`, or `DATABASE_PATH` to override the defaults. For example,
`HOST=0.0.0.0` makes the server reachable on the local network; do this only on
a trusted network because authentication is not implemented yet.

## Alert contract

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
database `id` and server-side `received_at` timestamp. Invalid JSON returns
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
