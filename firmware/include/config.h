#pragma once

#define NTP_SERVER "10.73.42.1"
#define HEURE_MINIMALE 1767225600

#define MQTT_TOPIC "sentinel/table/sensors/" DEVICE_ID

#define TOPIC_COMMANDES "sentinel-x/devices/" DEVICE_ID "/commands"
#define TOPIC_RESULTATS "sentinel-x/devices/" DEVICE_ID "/command-results"
#define TOPIC_PRESENCE  "sentinel-x/devices/" DEVICE_ID "/status"

#define PERIODE_ENVOI_MS 2000
#define DUREE_BUZZER_MAX_MS 30000
