# Guide de connexion d'une carte ESP8266 à la borne

Destiné au pilier **DEV** (`firmware/`). Tout ce qui suit a été **mesuré sur la
borne**, pas déduit : les valeurs non vérifiées sur matériel sont signalées
explicitement en fin de document.

Document rédigé depuis `infra/` : il décrit le **service** rendu par la borne.
Le choix du code embarqué (bibliothèques, structure du `firmware/`) reste à
l'équipe DEV.

---

## 1. Ce que la borne expose à une carte

| Service | Adresse | Port | Remarque |
|---|---|---|---|
| Point d'accès WiFi | SSID et clé : `CREDENTIALS.md`, section « Point d'accès WiFi » | — | 3 adresses en DHCP, pas d'Internet |
| Passerelle | `10.73.42.1` | — | la borne elle-même |
| Heure (NTP) | `10.73.42.1` | `123/udp` | annoncé par DHCP (option 42) |
| Broker MQTT **chiffré** | `10.73.42.1` | `8883/tcp` | TLS obligatoire, CA privée |
| DNS | `10.73.42.1` | `53/udp` | inutile pour une carte |

Une carte reçoit une adresse en `10.73.42.2` – `10.73.42.4`.

> Une carte **n'a pas accès à Internet**. Ce confinement est voulu : même
> compromise, elle ne peut rien exfiltrer. Conséquence directe : **l'heure doit
> venir de la borne**, sinon aucune validation de certificat n'est possible.

## 2. Pourquoi l'heure vient avant tout

Le broker présente un certificat valable du **6 octobre 2026 au 5 octobre
2028**. Une carte qui démarre « à l'heure époch » (1970) voit ce certificat
comme *pas encore valide* et la négociation TLS échoue — avec un message qui ne
parle pas d'horloge. Enchaînement obligatoire :

1. se connecter au WiFi ;
2. **synchroniser l'heure** sur `10.73.42.1` (NTP) ;
3. attendre une heure plausible (par exemple postérieure à 2026) ;
4. *alors seulement* ouvrir la connexion TLS.

La borne continue de servir l'heure **même sans Internet** (`local stratum 10`
dans chrony) : le cas de la démonstration en salle isolée est couvert.

## 3. Le broker

### 3.1 Certificat

Autorité privée **Sentinel-X CA** (ECDSA P-256, 2 ans). Ce n'est pas un secret :
c'est une clé **publique**, indispensable pour que la carte sache à qui elle
parle. Une copie est disponible pour l'équipe :

```bash
# depuis le poste de dev (hors dépôt Git, chmod 600)
config/mosquitto-ca.crt
```

À embarquer dans le firmware, **pas dans Git** :

- soit dans un en-tête dédié `firmware/include/ca_cert.h` (le `.gitignore` du
  dépôt ne bloque que `firmware/include/secrets.h`) ;
- soit en copiant le contenu du PEM dans une constante.

> Une clé privée ne doit **jamais** quitter `/opt/sentinel-x/stack/mosquitto/certs`
> sur la borne. Seul `ca.crt` est public.

### 3.2 Authentification

| Paramètre | Valeur |
|---|---|
| utilisateur | `esp` |
| mot de passe | `CREDENTIALS.md` → `MOSQUITTO_ESP_PASSWORD` |
| anonyme | **refusé** (`allow_anonymous false`) |
| TLS | obligatoire sur `8883`, aucune écoute en clair |

Les mots de passe sont stockés **hachés** sur la borne (PBKDF2-SHA512, 101
itérations) : impossible de les relire, on les régénère si besoin.

### 3.3 Droits de l'utilisateur `esp` (ACL)

```
écrire : sentinel/table/sensors/#      <- ses propres mesures
lire   : sentinel/table/actuators/#    <- les ordres qui lui sont destinés
```

Une carte **ne peut pas** :

- écrire dans `actuators` (elle ne commande pas les autres) ;
- lire `sensors` d'une autre carte ;
- écrire ailleurs que sous `sentinel/table/sensors/`.

## 4. Topics

```
sentinel/table/sensors/<device_id>
sentinel/table/sensors/<device_id>/<grandeur>
```

`<device_id>` : 1 à 128 caractères, lettres/chiffres/`-`/`_` conseillés
(exemple : `esp8266-lab-01`). C'est lui qui apparaîtra dans le tableau de bord
et dans la base : **un identifiant par carte**, pas `esp8266` pour toutes.

### 4.1 Format recommandé : une trame JSON par envoi

```json
{
  "timestamp": "2026-10-07T07:50:00Z",
  "measurements": { "temperature_c": 21.4, "humidity_pct": 55, "battery_v": 3.28 },
  "sensor_states": { "temperature": "ok", "motion": false }
}
```

- `measurements` : uniquement des **nombres** (sinon ignorés) ;
- `sensor_states` : **chaînes** ou **booléens** (états, portes, alarmes) ;
- `timestamp` : RFC 3339 **avec fuseau** (`Z` ou `+02:00`). S'il manque ou qu'il
  est invalide, le pont met l'heure de réception et le signale dans ses journaux.

Un seul `publish` par cycle complet : c'est ce qui permet de garder ensemble
toutes les grandeurs d'un même instant.

### 4.2 Formes acceptées (secours)

| Topic | Charge utile | Interprétation |
|---|---|---|
| `…/sensors/esp8266-lab-01` | objet JSON avec `measurements` / `sensor_states` | trame structurée |
| `…/sensors/esp8266-lab-01` | `{"temperature_c":22.1,"motion":true}` | objet plat : nombres → mesures, reste → états |
| `…/sensors/esp8266-lab-01/temperature_c` | `22.9` | mesure nommée par le topic |

Toute trame non exploitable est **journalisée et ignorée** par le pont, jamais
silencieusement perdue dans un 500 de l'API.

## 5. Ce qui se passe ensuite

```
carte --MQTTS--> sentinel-mosquitto --(interne)--> sentinel-mqtt-bridge
      --> POST /api/v1/alerts --> sentinel-api --> InfluxDB 3 --> GET / websocket
```

Le pont (`infra/stack/bridge/`) met la trame en forme et l'écrit **par l'API**,
seule porte d'entrée de la base. Il ne juge rien : pas de seuil, pas de
« si température > 40 ». Le modèle prédictif (pilier IA) lit la base et décide.

**Vérifier qu'une trame est bien arrivée :**

```bash
curl -s 'http://127.0.0.1:3000/api/v1/alerts?limit=5'
```

## 6. Esquisse de séquence (à traduire dans `firmware/`)

```cpp
// 1. WiFi
WiFi.mode(WIFI_STA);
WiFi.begin(SSID, PASSWORD);
while (WiFi.status() != WL_CONNECTED) delay(500);

// 2. Heure AVANT le TLS : sans elle, le certificat semble « pas encore valide »
configTime(0, 0, "10.73.42.1");
while (time(nullptr) < 1767225600) delay(500);   // garde-fou : 01/01/2026

// 3. TLS avec la CA privée
BearSSL::WiFiClientSecure net;
net.setTrustAnchors(&caCert);        // ou net.setCACert(CA_PEM) selon la librairie
PubSubClient client(net);
client.setServer("10.73.42.1", 8883);

// 4. Connexion puis publication
while (!client.connected()) client.connect("esp8266-lab-01", "esp", MOT_DE_PASSE);
client.publish("sentinel/table/sensors/esp8266-lab-01", payload, false);
```

Points d'attention BearSSL côté ESP8266 :

- la vérification du **nom du serveur** porte sur `10.73.42.1` (SAN `IP Address`)
  : appeler le broker par son **adresse IP**, pas par un nom inventé ;
- une session TLS coûte de la mémoire : **une connexion par cycle**, pas de
  `connect()`/`disconnect()` frénétiques, garder la connexion ouverte si
  possible ;
- QoS 1 si la mesure est précieuse ; QoS 0 pour un flux très fréquent.

## 7. Ce qui n'a PAS été vérifié

Par honnêteté méthodologique (aucune carte n'était disponible pendant la mise
en service) :

| Élément | État |
|---|---|
| Broker, TLS, ACL, authentification, pont, stockage | **vérifiés sur la borne** (voir `../../../../JOURNAL.md`) |
| Compilation du sketch ci-dessus | **non vérifiée** — à valider par DEV sur carte |
| `PubSubClient` + BearSSL sur ESP8266 avec une CA ECDSA P-256 | **non vérifiée** — à valider |
| Réaction réelle d'une carte à l'option DHCP 42 | **non vérifiée** — l'option est annoncée |

Une difficulté rencontrée côté carte doit être **ajoutée ici** : c'est ce genre
de retour qui évite à l'équipe suivante de perdre une heure.
