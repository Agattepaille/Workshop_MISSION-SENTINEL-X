# Stack applicative — API + InfluxDB 3 Core

Ensemble de conteneurs déployé sur la borne (le PC Serveur Local de l'option A
du cahier des charges) : une **API Node** et une **base temporelle**, isolées
sur un réseau Docker interne.

| Service | Image | Rôle | Exposition |
|---|---|---|---|
| `sentinel-api` | construite locale (`node:24.21.0-bookworm-slim`) | `GET`/`POST /api/v1/alerts`, WebSocket `/ws` | `127.0.0.1:3000` **et** `10.73.42.1:3000` (ingestion ESP8266) |
| `sentinel-influxdb` | `influxdb:3.11.6-core` | stockage temporel | aucun port publié |

Empreinte mesurée au repos : **88 Mio** (API) + **122 Mio** (base), bornées à
512 Mio et 1 Gio par `deploy.resources.limits`.

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

# 4. premiers lancements
cd /opt/sentinel-x/stack
docker compose up -d --build
docker volume inspect sentinel-x_influxdb3-data -f '{{.Mountpoint}}' \
  | xargs sudo chown 1500:1500        # le volume naît root, la base tourne en 1500
docker compose restart influxdb3-core
```

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
curl 'http://127.0.0.1:3000/api/v1/alerts?limit=10'
docker compose exec api node scripts/send-alert-dataset.js   # 5 alertes de démo
docker compose exec -T -e INFLUXDB3_AUTH_TOKEN="$TOKEN" influxdb3-core \
  influxdb3 show databases
```

Arrêt / relance : `docker compose down` puis `up -d`. Les conteneurs
redémarrent seuls au boot (`restart: unless-stopped`) ; Docker est ordonnancé
**après** `create-uap0.service`, sinon la publication sur `10.73.42.1` échoue.

## Sécurité

- **Aucun port en `0.0.0.0`** (invariant du projet).
- Deux réseaux : `sentinel-core` (`internal: true`, API ↔ base, rien n'en sort,
  aucun port publié) et `sentinel-edge` (accroche d'exposition : Docker refuse
  de publier un port depuis un réseau `internal`).
- Secrets **jamais** dans ce dépôt : `.gitignore` bloque déjà `.env*`. Le jeton
  vit dans `CREDENTIALS.md` et dans `/opt/sentinel-x/stack/.env` en `600`.
- L'API n'a **aucune authentification** (état du code DEV) : ne pas exposer au
 -delà du loopback et de `uap0` sans reverse proxy.

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
