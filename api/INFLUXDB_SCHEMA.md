# API InfluxDB schema

The API stores alerts and events in an InfluxDB 3 Core database. InfluxDB is
schema-on-write, so this document describes the point layouts written by the API
rather than relational `CREATE TABLE` definitions.

## Database and measurement

| Item            | Name                                     | Description                                             |
| --------------- | ---------------------------------------- | ------------------------------------------------------- |
| Database        | `INFLUX_DATABASE` (defaults to `alerts`) | Configured through the API environment                  |
| Measurement     | `alerts`                                 | One point for each accepted alert                       |
| Point timestamp | `timestamp`                              | The alert's RFC 3339 timestamp, stored as InfluxDB time |

Events are stored separately in the `events` measurement. Each confirmed
continuous camera presence creates one point; no image data is stored.

Create the default database if it does not exist:

```sh
influxdb3 create database alerts --token '<your-influxdb3-token>'
```

## Point layout

| Column               | InfluxDB type  | Source                                 | Notes                                                                            |
| -------------------- | -------------- | -------------------------------------- | -------------------------------------------------------------------------------- |
| `alert_id`           | Tag (string)   | API-generated UUID                     | Identifies the alert and breaks ties when listing alerts with the same timestamp |
| `device_id`          | Tag (string)   | `device_id` in the request             | Identifies the sending device                                                    |
| `payload_json`       | Field (string) | Complete validated alert, JSON-encoded | Preserves `timestamp`, `device_id`, `measurements`, and `sensor_states`          |
| `received_at`        | Field (string) | API receipt time in RFC 3339           | Time the API accepted the alert; distinct from the point timestamp               |
| `measurement_<name>` | Field (float)  | Each entry in `measurements`           | For example, `measurements.temperature_c` becomes `measurement_temperature_c`    |

The measurement field names are dynamic: the API accepts measurement names from
1 to 64 characters and writes each numeric value as a float field prefixed with
`measurement_`. Sensor states are retained in `payload_json`; they are not
separate InfluxDB columns.

## Event point layout

| Column        | InfluxDB type  | Source                       | Notes                                        |
| ------------- | -------------- | ---------------------------- | -------------------------------------------- |
| `event_id`    | Tag (string)   | API-generated UUID           | Identifies the event and breaks time ties    |
| `source_type` | Tag (string)   | `source_type` in the request | Currently `camera`                           |
| `source_id`   | Tag (string)   | `source_id` in the request   | Camera identifier, currently `CAM-ENT-03`    |
| `received_at` | Field (string) | API receipt time in RFC 3339 | Distinct from the dashboard's detection time |

The point timestamp is the detection observation time supplied by the
dashboard. The camera dashboard polls the vision service approximately once per
second, so this is the first poll that observes the person rather than the
precise YOLO frame timestamp.

Example request:

```json
{
  "timestamp": "2026-10-08T18:30:00.000Z",
  "source_type": "camera",
  "source_id": "CAM-ENT-03"
}
```

## Event query example

```sql
SELECT time, event_id, source_type, source_id, received_at
FROM events
ORDER BY time DESC, event_id DESC
LIMIT 1;
```

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
