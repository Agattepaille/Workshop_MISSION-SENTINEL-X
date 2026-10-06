# Firmware ESP8266

Micrologiciel C++ (PlatformIO) du module ESP8266 (NodeMCU v3) :

- lecture des capteurs HC-SR04 (distance), DHT22 (température/humidité),
  MQ-2 (gaz/fumée) et PIR HC-SR501 (présence) ;
- connexion au Wi-Fi de la table ;
- exposition des mesures en JSON sur `GET /api/sensors`.

À venir : affichage du statut IP/Wi-Fi sur l’écran OLED I2C, envoi des données
au PC Serveur Local (MQTT / `POST /api/v1/alerts`) et pilotage des actionneurs
(buzzer, LEDs).

## Configuration

Les identifiants Wi-Fi vont dans `include/secrets.h`, ignoré par Git. Copiez le
modèle puis complétez-le :

```sh
cp include/secrets.example.h include/secrets.h
```

L’ESP8266 ne fonctionne qu’en Wi-Fi **2,4 GHz**.

## Compiler et téléverser

Depuis le dossier `firmware/` (ou avec l’extension PlatformIO de VS Code,
tâche **Upload and Monitor**) :

```sh
pio run --target upload --target monitor
```

Le moniteur série (115200 bauds) affiche l’adresse IP obtenue. Les mesures sont
ensuite disponibles sur `http://<IP>/api/sensors` :

```json
{
  "dht22": { "temperature": 26.3, "humidity": 45.6 },
  "mq2": { "gasRaw": 16 },
  "pir": { "motion": true },
  "hcsr04": { "distanceCm": 19.8 }
}
```

`temperature`, `humidity` et `distanceCm` valent `null` quand la lecture échoue
(DHT22 non prêt, aucun écho reçu par le HC-SR04).

## Câblage

Les capteurs 5 V sont alimentés par le rail **+** de la breadboard, relié à
`VU` (5 V de l’USB). Le rail **−** est relié à `G`.

| Capteur | Broche capteur | Branchement                                         |
| ------- | -------------- | --------------------------------------------------- |
| —       | —              | NodeMCU `VU` → rail **+**, NodeMCU `G` → rail **−** |
| HC-SR04 | Vcc / Gnd      | rail **+** / rail **−**                             |
| HC-SR04 | Trig           | `D0`                                                |
| HC-SR04 | Echo           | 1 kΩ → `D5`, puis 2 kΩ de `D5` vers rail **−**      |
| DHT22   | + / −          | NodeMCU `3V` / `G`                                  |
| DHT22   | out            | `D7`                                                |
| PIR     | VCC / GND      | rail **+** / rail **−**                             |
| PIR     | OUT            | `D6`                                                |
| MQ-2    | VCC / GND      | rail **+** / rail **−**                             |
| MQ-2    | AO             | `A0`                                                |

Le pont diviseur sur Echo ramène le signal 5 V du HC-SR04 à environ 3,3 V,
la tension maximale tolérée par les broches de l’ESP8266.

Le MQ-2 a besoin d’environ 2 minutes de chauffe après la mise sous tension
avant de donner des valeurs stables. Le PIR a besoin d’environ 1 minute de
calibration.
