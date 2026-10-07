# Stack applicative — API, base temporelle, broker MQTT

Ensemble de conteneurs déployé sur la borne (le PC Serveur Local de l'option A
du cahier des charges) : une **API Node**, une **base temporelle** et un
**broker MQTT** relié à l'API par un pont, isolés sur un réseau Docker interne.

| Service | Image | Rôle | Exposition |
|---|---|---|---|
| `sentinel-api` | construite locale (`node:24.21.0-bookworm-slim`) | `GET`/`POST /api/v1/alerts`, WebSocket `/ws` | `127.0.0.1:3000` **et** `10.73.42.1:3000` (ingestion ESP8266) |
| `sentinel-influxdb` | `influxdb:3.11.6-core` | stockage temporel | aucun port publié |
| `sentinel-mosquitto` | `eclipse-mosquitto:2.0.22-openssl` | broker des cartes | `10.73.42.1:8883` (MQTTS) **et** `127.0.0.1:8884` (MQTT/WebSocket TLS) |
| `sentinel-mqtt-bridge` | construite locale (`node:24.21.0-bookworm-slim`) | lit le broker, écrit dans l'API | aucun port publié |

Empreinte mesurée au repos : **88 Mio** (API) + **122 Mio** (base), bornées à
512 Mio et 1 Gio par `deploy.resources.limits` ; le broker et le pont sont
plafonnés à 128 Mio chacun.

Deux documents d'usage complètent ce README :

- [`docs/guide-connexion-esp.md`](docs/guide-connexion-esp.md) — ce qu'une carte
  doit faire pour publier (topics, trames, TLS, heure).
- [`docs/guide-mqtt-dashboard.md`](docs/guide-mqtt-dashboard.md) — comment
  l'interface lit le flux MQTT, et pourquoi elle n'y est pas obligée.

---

## Pourquoi InfluxDB 3 Core

Ce n'est pas un choix de goût : c'est **ce que le code de l'API appelle**.
`api/src/persistence/influx-client.js` utilise
`@influxdata/influxdb3-client`, c'est-à-dire

- écriture en **line protocol** (API v3, `useV2Api: false`),
- lecture en **SQL** (`SELECT … FROM alerts`), port par défaut **8181**.

Toute base v2 (org + bucket, Flux, port 8086), PostgreSQL ou MySQL obligerait à
réécrire la couche de persistance : hors sujet de ce dossier.

### Schéma de données

Aucune migration à appliquer : InfluxDB 3 est **schema-on-write**, la mesure se
crée à la première écriture. Détail complet dans `api/INFLUXDB_SCHEMA.md`.

| Élément | Type | Origine |
|---|---|---|
| mesure `alerts` | — | `alert-repository.influx.js:24` |
| `alert_id` | tag | UUID généré par l'API |
| `device_id` | tag | payload `device_id` |
| `payload_json` | field | alerte validée, en JSON |
| `received_at` | field | heure de réception RFC 3339 |
| `measurement_<nom>` | field (float) | chaque entrée de `measurements` |
| `time` | horodatage | `timestamp` de l'alerte |

Base créée explicitement **pour fixer la rétention**, car celle-ci ne peut plus
être modifiée ensuite : `--retention-period 30d`.

---

## Prérequis système (deux points non négociables)

1. **Noyau en pages de 4 Ko.** Le Pi 5 démarre par défaut sur `kernel_2712.img`
   (pages de 16 Ko). Le jemalloc embarqué dans InfluxDB 3 refuse ces pages :
   `Unsupported system page size` puis `memory allocation of N bytes failed`.
   Correctif appliqué : `kernel=kernel8.img` dans `/boot/firmware/config.txt`.
2. **Contrôleur mémoire cgroup.** Sans lui, Docker ignore silencieusement les
   limites (`Your kernel does not support memory limit capabilities`). Activé
   par `cgroup_enable=memory cgroup_memory=1` dans `/boot/firmware/cmdline.txt`.

Voir la section 6 de `AGENTS.md` pour le reste (MTU 1400 obligatoire derrière le
partage de connexion).

---

## Installation

```bash
# 1. depuis le poste de dev, déposer les fichiers (aucun secret n'est copié)
bash infra/stack/deploy.sh

# 2. sur la borne, créer les secrets UNE fois
install -d -m 0750 /opt/sentinel-x/stack/secrets
cat > /opt/sentinel-x/stack/secrets/admin-token.json <<'JSON'
{"token": "apiv3_<jeton>", "name": "sentinel-admin", "description": "Opérateur InfluxDB 3"}
JSON
# droits exigés par InfluxDB : 600, appartenant à l'utilisateur du conteneur
chown 1500:1500 /opt/sentinel-x/stack/secrets/admin-token.json
chmod 600        /opt/sentinel-x/stack/secrets/admin-token.json

# 3. .env (600) — modèle dans .env.example, valeurs dans CREDENTIALS.md
#    INFLUX_DATABASE=alerts
#    INFLUX_TOKEN=<le même jeton apiv3_…>
#    MQTT_PASSWORD=<mot de passe de l'utilisateur "bridge" du broker>

# 3 bis. secrets du broker : autorité privée + comptes, UNE fois, sur la borne.
#        Ils ne traversent jamais le dépôt : deploy.sh ne copie que les
#        configurations sans secret.
install -d -m 0750 /opt/sentinel-x/stack/mosquitto/certs
# 1) CA et certificat serveur (ECDSA P-256, SAN IP:10.73.42.1)
# 2) comptes : esp (cartes), api (serveur/IA), ia (modèle), bridge (pont, lecture seule)
docker exec sentinel-mosquitto sh -c 'mosquitto_passwd -c -b /tmp/pw esp "<secret>"'
docker cp sentinel-mosquitto:/tmp/pw /opt/sentinel-x/stack/mosquitto/config/passwords
chown 1883:1883 /opt/sentinel-x/stack/mosquitto/config/passwords   # uid du conteneur

# 4. premiers lancements
cd /opt/sentinel-x/stack
docker compose up -d --build
docker volume inspect sentinel-x_influxdb3-data -f '{{.Mountpoint}}' \
  | xargs sudo chown 1500:1500        # le volume naît root, la base tourne en 1500
docker compose restart influxdb3-core
```

> Les mots de passe du broker sont **hachés** (PBKDF2-SHA512, 101 itérations) :
> impossibles à relire depuis le fichier. Les consigner dans `CREDENTIALS.md`
> **au moment où on les génère**, sinon le compte est perdu pour tout le monde.

Ne reste qu'à créer la base, avec sa rétention :

```bash
TOKEN=$(awk -F= '/^INFLUX_TOKEN=/{print $2}' .env)
docker compose exec -T -e INFLUXDB3_AUTH_TOKEN="$TOKEN" influxdb3-core \
  influxdb3 create database alerts --retention-period 30d
```

> Attention : `deploy.sh` remet `root:root` sur tout le dépôt déployé **sauf**
> `stack/secrets`, précisément pour ne pas casser ces droits.

## Exploitation

```bash
docker compose ps                              # état et santé
docker compose logs -f api                     # journaux applicatifs
docker compose logs -f mqtt-bridge             # transmissions MQTT -> API
curl 'http://127.0.0.1:3000/api/v1/alerts?limit=10'
docker compose exec api node scripts/send-alert-dataset.js   # 5 alertes de démo
docker compose exec -T -e INFLUXDB3_AUTH_TOKEN="$TOKEN" influxdb3-core \
  influxdb3 show databases
```

Le pont écrit une ligne JSON par trame. Statistiques toutes les 5 minutes, et
une ligne `Etat du pont` permet de voir d'un coup ce qui est reçu, transmis ou
rejeté :

```bash
docker compose logs mqtt-bridge | tail
# {"level":"info","msg":"Mesure transmise a l API","device_id":"esp8266-lab-01","status":201}
```

Arrêt / relance : `docker compose down` puis `up -d`. Les conteneurs
redémarrent seuls au boot (`restart: unless-stopped`) ; Docker est ordonnancé
**après** `create-uap0.service`, sinon la publication sur `10.73.42.1` échoue.

## Sécurité

- **Aucun port en `0.0.0.0`** (invariant du projet).
- Deux réseaux : `sentinel-core` (`internal: true`, API ↔ base ↔ broker, rien n'en sort,
  aucun port publié) et `sentinel-edge` (accroche d'exposition : Docker refuse
  de publier un port depuis un réseau `internal`).
- Secrets **jamais** dans ce dépôt : `.gitignore` bloque déjà `.env*`. Le jeton
  vit dans `CREDENTIALS.md` et dans `/opt/sentinel-x/stack/.env` en `600`.
- L'API n'a **aucune authentification** (état du code DEV) : ne pas exposer au
  -delà du loopback et de `uap0` sans reverse proxy.

### Broker et pont

- Anonymat **refusé** ; le port `1883` (non chiffré) n'est accessible **qu'à
  l'intérieur** du réseau Docker, jamais depuis la borne ni depuis le WiFi.
- ACL par compte, principe du moindre privilège
  (`mosquitto/acl`) : une carte n'écrit que ses capteurs et ne lit que ses
  ordres ; le pont utilise un compte **lecture seule**, donc un pont compromis
  ne peut pas commander les actionneurs.
- Certificats **ECDSA P-256** : petits, donc adaptés à un microcontrôleur, et
  validés par la carte elle-même — ce qui impose de lui fournir l'heure.

### Heure des cartes (hors Docker, volontairement)

Les cartes n'ont pas d'Internet et doivent pourtant valider la période de
validité du certificat du broker. `chrony` est donc installé **sur l'hôte**, en
binaire systemd, pas en conteneur : il doit être disponible même si Docker est
tombé. Trois garde-fous dans `/etc/chrony/conf.d/10-sentinel-ap.conf` :

| Directive | Effet |
|---|---|
| `binddevice uap0` | le socket NTP n'existe que sur le point d'accès |
| `allow 10.73.42.0/29` | seul le sous-réseau de la table est servi |
| `local stratum 10` | la borne donne l'heure même sans Internet (démonstration isolée) |

Le service est ordonnancé **après** `create-uap0.service` (drop-in systemd) :
sans `uap0`, `chronyd` refuse de démarrer.

## Pièges rencontrés ici

| Symptôme | Cause | Correction |
|---|---|---|
| `Unsupported system page size` | noyau 16 Ko du Pi 5 | `kernel=kernel8.img` |
| base en `Restarting (133)` | volume ou fichier de jeton en `root` | `chown 1500:1500` |
| `Invalid token format` | jeton sans préfixe | `apiv3_<aléa>` |
| `insecure permissions: 640` puis refus de lecture | InfluxDB exige 600 et être propriétaire | `600` + `chown 1500:1500` |
| `AUCUN port publié` malgré `ports:` | réseau `internal` | second bridge pour l'exposition |
| premier `GET` en `500` | la mesure n'existe pas encore (schema-on-write) | écrire une première alerte |
| limites mémoire ignorées | contrôleur mémoire absent | `cgroup_enable=memory cgroup_memory=1` |
| `"/bridge/src": not found` au build | contexte de construction = racine du déploiement | chemins `stack/bridge/…` dans le Dockerfile |
| `npm ci` impossible dans l'image | `package-lock.json` non déployé | `deploy.sh` copie le verrou, pas seulement `package.json` |
| NTP visible en `0.0.0.0` dans `ss` | `binddevice` lie à l'interface mais `ss` ne l'affiche pas | le prouver par un test depuis une autre interface, pas par `ss` |
| une trame MQTT n'arrive jamais dans l'API | topic hors `sentinel/table/sensors/#`, ou trame non JSON ni nombre | lire `docker compose logs mqtt-bridge` : la cause est écrite |
| `Mosquitto refuses to start` après `cap_drop: ALL` | l'image réattribue ses certificats avant de s'exécuter | ne pas retirer toutes les capacités (voir `AGENTS.md`, piège 6) |
