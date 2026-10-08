#pragma once

#define DEVICE_ID      "ESP-X"
#define WIFI_SSID      "NomDuReseau"
#define WIFI_PASSWORD  "MotDePasseWifi"

#define MQTT_HOST      "10.73.42.1"
#define MQTT_PORT      8883
#define MQTT_USER      "esp"
#define MQTT_PASSWORD  "MotDePasseMqtt"

static const char MQTT_CA_PEM[] = R"PEMCONTENT(
-----BEGIN CERTIFICATE-----
...
-----END CERTIFICATE-----
)PEMCONTENT";

static const char MQTT_CLIENT_CERT_PEM[] = R"PEMCONTENT(
-----BEGIN CERTIFICATE-----
...
-----END CERTIFICATE-----
)PEMCONTENT";

static const char MQTT_CLIENT_KEY_PEM[] = R"PEMCONTENT(
-----BEGIN EC PRIVATE KEY-----
...
-----END EC PRIVATE KEY-----
)PEMCONTENT";
