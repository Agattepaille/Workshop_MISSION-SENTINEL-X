# Firmware ESP8266

Micrologiciel C++ (PlatformIO) pour deux cartes NodeMCU v3 :

| Environnement | Carte | Rôle                                                                      |
| ------------- | ----- | ------------------------------------------------------------------------- |
| `esp_a`       | ESP A | capteurs (HC-SR04, PIR, MQ-2, DHT22) + afficheur 7 segments, JSON Wi-Fi   |
| `esp_b`       | ESP B | actionneurs : 2 moteurs pas-à-pas 28BYJ-48, buzzer                        |

L’écran OLED I2C est branché sur le Raspberry Pi de la borne, pas sur une carte.

Les deux cartes partagent la connexion à la borne (`include/connexion_borne.h`) :
dès qu’elles sont allumées, elles se connectent au Wi-Fi, récupèrent l’heure,
ouvrent la session MQTTS et publient en continu. Si le Wi-Fi ou le broker
tombe, elles se reconnectent seules (nouvelle tentative toutes les 5 s). Le
pont de la borne transmet chaque trame à l’API (`POST /api/v1/alerts`).

L’ESP B publie son état toutes les 2 s sur `sentinel/table/sensors/ESP-2`
(`rssi_dbm`, `uptime_s`, état du buzzer et des moteurs). À la première
connexion au broker, elle bipe autant de fois que le dernier chiffre de son
adresse IP (4 bips = `10.73.42.4`).

L’ESP A publie ses mesures en **MQTTS** vers le broker de la borne, selon
`infra/stack/docs/guide-connexion-esp.md` : Wi-Fi, puis heure NTP depuis
`10.73.42.1`, puis **mutual TLS** (CA privée + certificat et clé de la carte),
puis publication toutes les 2 s (et immédiatement quand le PIR change d’état)
sur `sentinel/table/sensors/ESP-1` :

```json
{
  "timestamp": "2026-10-07T07:50:00Z",
  "measurements": { "temperature_c": 24.7, "humidity_pct": 53.8, "gas_raw": 84, "distance_cm": 29.7 },
  "sensor_states": { "motion": true }
}
```

Une mesure indisponible (DHT22 non prêt, aucun écho du HC-SR04) est omise.
Les paramètres non secrets (serveur NTP, topics, période) sont dans
`include/config.h`.

Le broker est appelé par son adresse IP brute : BearSSL ne sait pas comparer un
nom de serveur à un SAN `IP Address` (erreur TLS 56 « Expected server name was
not found in the chain »). La vérification du nom est donc sautée, mais la
chaîne de certificats reste vérifiée par la CA Sentinel-X et le mutual TLS est
conservé.

À venir : pilotage des moteurs de l’ESP B.

## Commandes du dashboard (ESP B)

L’ESP B suit le contrat de l’API (`api/README.md`) :

| Sens          | Topic                                     | Contenu                                                     |
| ------------- | ----------------------------------------- | ----------------------------------------------------------- |
| API → ESP B   | `sentinel-x/devices/ESP-2/commands`       | `{"command_id":"…","device_id":"ESP-2","action":"buzzer.trigger","duration_ms":5000}` |
| ESP B → API   | `sentinel-x/devices/ESP-2/command-results`| `{"command_id":"…","status":"completed"}` ou `failed` + `error` |
| ESP → API     | `sentinel-x/devices/<id>/status`          | `{"online":true}` (retenu), `{"online":false}` en testament  |

`buzzer.trigger` fait sonner le buzzer pendant `duration_ms` (30 s au plus)
sans bloquer l’envoi des mesures ; la réponse `completed` part dès le
déclenchement. Les autres actions (`leds.test`, `leds.auto`) sont refusées avec
`failed` : la carte n’a pas de LED. Le nombre de commandes reçues est visible
sur `http://<IP>/api/status`.

Ces topics doivent être autorisés dans `infra/stack/mosquitto/acl` (lecture des
commandes et écriture des résultats et du statut pour `esp`, l’inverse pour
`api`). Tant que l’ACL refuse le statut, les cartes se connectent sans
testament et `/api/status` l’indique.

## Configuration

Chaque carte a son propre `secrets.h`, livré par l’INFRA (dossier
`esp-certs/`, hors dépôt) : identifiant de la carte, Wi-Fi, compte MQTT,
certificat de la CA, certificat et **clé privée** de la carte.

| Carte | Fichier livré        | Emplacement dans le firmware   |
| ----- | -------------------- | ------------------------------ |
| ESP A | `ESP-1/secrets.h`    | `include/esp_a/secrets.h`      |
| ESP B | `ESP-2/secrets.h`    | `include/esp_b/secrets.h`      |

Ces fichiers sont ignorés par Git (`firmware/include/*/secrets.h`) : vérifiez
qu’ils n’apparaissent jamais dans `git status`. Leur structure, sans aucune
valeur réelle, est décrite dans `include/secrets.example.h`.

L’ESP8266 ne fonctionne qu’en Wi-Fi **2,4 GHz**.

## Compiler et téléverser

**Ne branchez qu’une seule carte en USB pendant un téléversement**, sinon
PlatformIO peut flasher la mauvaise.

```sh
pio run -e esp_a --target upload   # ESP A
pio run -e esp_b --target upload   # ESP B
```

Dans VS Code, les tâches sont dans le panneau PlatformIO sous `esp_a` et
`esp_b`.

`RX` et `TX` servent de sorties sur les deux cartes : **le moniteur série
n’affiche rien**. Pour vérifier le fonctionnement :

- **ESP A** : au démarrage, l’afficheur allume chaque segment puis les chiffres
  0 à 9, fait tourner un segment pendant la connexion Wi-Fi, puis affiche la fin
  de son adresse IP (ex. `3` pour `10.73.42.3`). Ensuite, il affiche `P` en cas
  de mouvement, sinon la distance du HC-SR04 en décimètres (`-` si pas d’écho).
  Un tiret clignote pendant la synchronisation de l’heure. L’état de la
  connexion MQTT est visible sur `http://<IP>/api/status` (codes d’erreur MQTT
  et TLS compris). Les mesures brutes restent disponibles sur
  `http://<IP>/api/sensors` :

  ```json
  {
    "dht22": { "temperature": 26.3, "humidity": 45.6 },
    "mq2": { "gasRaw": 16 },
    "pir": { "motion": true },
    "hcsr04": { "distanceCm": 19.8 }
  }
  ```

- **ESP B** : les bips donnent la fin de son adresse IP ; l’état de la
  connexion MQTT est visible sur `http://<IP>/api/status`, comme pour l’ESP A.

## Câblage

### Breadboard

| Zone                         | Rôle                                                         |
| ---------------------------- | ------------------------------------------------------------ |
| Rail côté `a`                | `+` = ESP A `VU` (5 V), `−` = ESP A `G`                      |
| Colonne 2, rangées `f` à `j` | `+` 5 V de l’ESP B (ESP B `VU` → `f2`)                       |
| Colonne 4, rangées `f` à `j` | `−` de l’ESP B (ESP B `G` → `f4`)                            |
| Colonnes 1 à 11, `a` à `e`   | pont diviseur du HC-SR04                                     |
| Colonnes 15 à 21             | résistances 220 Ω du 7 segments, à cheval sur la rainure     |

### ESP A

| Composant          | Broche composant | Branchement                                               |
| ------------------ | ---------------- | --------------------------------------------------------- |
| HC-SR04            | Vcc / Gnd        | rail côté `a` `+` / `−`                                   |
| HC-SR04            | Trig             | `D3`                                                      |
| HC-SR04            | Echo             | `a1` → 1 kΩ `b1`–`b6` → `a6` → `D5` ; 2 kΩ `c6`–`c11`, `a11` → rail `−` |
| PIR HC-SR501       | VCC / GND / OUT  | rail côté `a` `+` / `−` / `D6`                            |
| MQ-2               | VCC / GND / AO   | rail côté `a` `+` / `−` / `A0`                            |
| DHT22              | + / − / out      | `3V` / `G` / `D4`                                         |
| 7 segments 5161AS  | a / b / c / d    | via 220 Ω → `D0` / `D1` / `D2` / `D7`                     |
| 7 segments 5161AS  | e / f / g        | via 220 Ω → `D8` / `RX` / `TX`                            |
| 7 segments 5161AS  | COM              | rail côté `a` `−`                                         |

Chaque segment : fil de la broche du 7 segments vers `aN`, résistance 220 Ω de
`eN` à `fN`, fil de `jN` vers l’ESP A (`N` = 15 pour a, 16 b, 17 c, 18 d, 19 e,
20 f, 21 g).

Broches du 5161AS (cathode commune), vu de face avec le point en bas à droite :

```
haut : g  f  COM  a  b
bas  : e  d  COM  c  DP
```

### ESP B

| Composant           | Broche composant      | Branchement                       |
| ------------------- | --------------------- | --------------------------------- |
| Moteur 1 (ULN2003)  | + / −                 | `g2` / `g4`                       |
| Moteur 1 (ULN2003)  | IN1 / IN2 / IN3 / IN4 | `D1` / `D2` / `D5` / `D6`         |
| Moteur 2 (ULN2003)  | + / −                 | `h2` / `h4`                       |
| Moteur 2 (ULN2003)  | IN1 / IN2 / IN3 / IN4 | `D7` / `D0` / `TX` / `RX`         |
| Buzzer              | milieu / − / S        | `i2` / `i4` / `S3`                |

Les cartes ULN2003 ne doivent pas être branchées sur `D3`, `D4` ou `D8` :
elles empêchent alors la NodeMCU de démarrer. Le buzzer bloque aussi le
démarrage s’il est sur `TX` : il est donc sur `S3` (GPIO10), utilisable parce
que l’environnement `esp_b` force la flash en mode DIO. Débranchez les fils
`RX` et `TX` de l’ESP B avant chaque téléversement. Les autres
broches `S1`, `S2`, `SC`, `SO`, `SK` sont reliées à la mémoire flash : n’y
branchez jamais rien.

Le pont diviseur sur Echo ramène le signal 5 V du HC-SR04 à environ 3,3 V,
la tension maximale tolérée par les broches de l’ESP8266. Le MQ-2 a besoin
d’environ 2 minutes de chauffe, le PIR d’environ 1 minute de calibration.
