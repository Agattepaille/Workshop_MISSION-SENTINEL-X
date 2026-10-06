# API InfluxDB schema

The API stores alerts in an InfluxDB 3 Core database. InfluxDB is schema-on-write,
so this document describes the point layout written by the API rather than a
relational `CREATE TABLE` definition.

## Database and measurement

| Item | Name | Description |
|---|---|---|
| Database | `INFLUX_DATABASE` (defaults to `alerts`) | Configured through the API environment |
| Measurement | `alerts` | One point for each accepted alert |
| Point timestamp | `timestamp` | The alert's RFC 3339 timestamp, stored as InfluxDB time |

Create the default database if it does not exist:

```sh
influxdb3 create database alerts --token '<your-influxdb3-token>'
```

## Point layout

| Column | InfluxDB type | Source | Notes |
|---|---|---|---|
| `alert_id` | Tag (string) | API-generated UUID | Identifies the alert and breaks ties when listing alerts with the same timestamp |
| `device_id` | Tag (string) | `device_id` in the request | Identifies the sending device |
| `payload_json` | Field (string) | Complete validated alert, JSON-encoded | Preserves `timestamp`, `device_id`, `measurements`, and `sensor_states` |
| `received_at` | Field (string) | API receipt time in RFC 3339 | Time the API accepted the alert; distinct from the point timestamp |
| `measurement_<name>` | Field (float) | Each entry in `measurements` | For example, `measurements.temperature_c` becomes `measurement_temperature_c` |

The measurement field names are dynamic: the API accepts measurement names from
1 to 64 characters and writes each numeric value as a float field prefixed with
`measurement_`. Sensor states are retained in `payload_json`; they are not
separate InfluxDB columns.

## Example alert and stored point

Request payload:

```json
{
  "timestamp": "2026-10-05T12:00:00Z",
  "device_id": "esp8266-demo",
  "measurements": {
    "temperature_c": 21.4,
    "humidity_pct": 55
  },
  "sensor_states": {
    "motion": false
  }
}
```

Logical point representation (the actual point also has its InfluxDB timestamp):

```text
measurement: alerts
tags:
  alert_id: <API-generated UUID>
  device_id: esp8266-demo
fields:
  measurement_temperature_c: 21.4
  measurement_humidity_pct: 55.0
  payload_json: <JSON-encoded request payload>
  received_at: <API receipt time>
```

## Query example

```sql
SELECT time, alert_id, device_id, measurement_temperature_c,
       measurement_humidity_pct, payload_json, received_at
FROM alerts
ORDER BY time DESC
LIMIT 50;
```

The `measurement_*` columns in a query depend on the measurement names that have
been written. The API's alert-list endpoint reads `time`, `alert_id`,
`payload_json`, and `received_at`, then reconstructs the response from the
stored JSON payload.

This schema targets the API's InfluxDB 3 Core client and endpoint. The separate
infrastructure Compose stack currently configures InfluxDB 2.7; that stack is
not compatible with this API client without a deliberate version/configuration
change.
