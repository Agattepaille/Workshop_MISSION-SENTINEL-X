import os
from datetime import datetime, timezone, timedelta

from influxdb_client_3 import InfluxDBClient3, Point


TOKEN = os.getenv("INFLUXDB3_AUTH_TOKEN")

HOST = "http://127.0.0.1:8181"
DATABASE = "mission_sentinel"


if not TOKEN:
    raise RuntimeError(
        "INFLUXDB3_AUTH_TOKEN n'est pas défini."
    )


client = InfluxDBClient3(
    host=HOST,
    token=TOKEN,
    database=DATABASE
)


# Données de test correspondant aux données alerts.csv
data = [
    {
        "temperature": 24.2,
        "humidity": 50.5,
        "gasRaw": 122.0,
    },
    {
        "temperature": 80.0,
        "humidity": 10.0,
        "gasRaw": 500.0,
    },
]


points = []

start_time = datetime.now(timezone.utc)


for i, item in enumerate(data):

    timestamp = start_time + timedelta(
        seconds=i * 5
    )

    point = (
        Point("alerts")
        .tag(
            "device_id",
            "esp8266-demo"
        )
        .field(
            "received_at",
            timestamp.isoformat()
        )
        .field(
            "alert_id",
            f"test-alert-{i + 1:03d}"
        )
        .field(
            "measurement_temperature_c",
            float(item["temperature"])
        )
        .field(
            "measurement_humidity_pct",
            float(item["humidity"])
        )
        .field(
            "measurement_gas_raw",
            float(item["gasRaw"])
        )
        .time(timestamp)
    )

    points.append(point)


client.write(record=points)

client.close()


print("✓ Données de test insérées")
print("✓ Database : mission_sentinel")
print("✓ Table : alerts")
print(f"✓ Nombre de lignes : {len(points)}")