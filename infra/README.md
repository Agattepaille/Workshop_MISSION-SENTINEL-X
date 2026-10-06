# Infrastructure — Mission Sentinel-X

Piliers **INFRA** et **CYBER**. Ce dossier documente le PC Serveur Local
(Raspberry Pi 5) : reseau, conteneurs, securite et supervision.

> **Regle absolue** : aucun secret dans Git. Mots de passe, tokens et cles
> privees vivent uniquement dans `/opt/sentinel-x/.env` (chmod 600) sur le RPi.
> `.env.example` liste les noms de variables, jamais leurs valeurs.

---

## 1. Architecture

```
                        Internet
                            |
                    Cloudflare Tunnel   (cloudflared, sortant)
                            |
                     Cloudflare Access  (mur : email/OTP)
                            |
                     grafana.nyasaoto.dev
                            |
  PC Admin ──eth0──> Raspberry Pi 5 ──wlan0──> AP WiFi ──> ESP8266
  192.168.100.1       192.168.100.2        10.73.42.1/29    10.73.42.2-4
  (SSH :2222)        10.73.42.1/29
                           |
                    Docker (reseau bridge "core")
        ┌──────────┬───────┴────────┬──────────────┐
     mosquitto  influxdb        telegraf       grafana
```

Quatre conteneurs, un seul point d'entree public (le tunnel Cloudflare), et
un reseau prive pour l'equipement.

## 2. Composants

| Service     | Image                  | Ports                  | Role |
|-------------|------------------------|------------------------|------|
| `mosquitto` | `eclipse-mosquitto:2.0`| `8883` (MQTTS, public AP) | Broker MQTT chiffre pour les ESP |
| `influxdb`  | `influxdb:2.7`         | `127.0.0.1:8086`       | Base temporelle |
| `telegraf`  | `telegraf:1.32`        | aucun                  | Collecte CPU/RAM/disque/Docker/MQTT |
| `grafana`   | `grafana/grafana:11.3.0`| `127.0.0.1:3000`      | Supervision (role Zabbix) |

**Mosquitto expose deux listeners** : `1883` en clair sur le reseau Docker
interne (jamais publie sur l'hote) et `8883` en TLS pour les ESP.

## 3. Reseau

- **AP WiFi** : SSID et PSK generes aleatoirement ( hors depot ).
- **Sous-reseau** : `/29` = 6 adresses utilisables, dont 3 en DHCP pour les
  ESP. Volontairement hors des plages domestiques (`192.168.x.x/10.0.0.x`)
  pour eviter les collisions avec les box des etudiants pendant les tests.
- **Isolation** : les ESP n'ont **pas** d'acces Internet. Ils ne joignent que
  le broker. Un ESP ne peut donc pas exfiltrer quoi que ce soit.
- Le plan d'adressage complet et la matrice de durcissement sont dans
  [SECURITE.md](SECURITE.md).

## 4. Deploiement

Sur le RPi, en tant que `sentinel-x12` :

```bash
cd /opt/sentinel-x
cp .env.example .env      # puis renseigner les valeurs
chmod 600 .env
docker network create core 2>/dev/null || true
docker compose up -d
docker compose ps
```

Les certificats TLS sont generes une seule fois (voir
[SECURITE.md](SECURITE.md) section 4) et **ne sont pas** dans ce depot.

Verification rapide :

```bash
# Le broker refuse-t-il un client anonyme ? (doit echouer)
docker exec sentinel-mosquitto mosquitto_pub --cafile /mosquitto/certs/ca.crt \
  -h 10.73.42.1 -p 8883 -t test -m x     # -> Connection Refused: not authorised

# La stack respire-t-elle ?
curl -s http://127.0.0.1:3000/api/health   # Grafana
```

## 5. Supervision

Dashboard **Sentinel-X - Supervision** : 4 sections (Point d'acces WiFi & ESP,
Broker MQTT/MQTTS, Raspberry Pi, Conteneurs Docker), 21 panneaux.

Acces : `https://grafana.nyasaoto.dev`
→ mur Cloudflare Access (email) → login Grafana `equipe` (lecture seule).

Le dashboard est **volontairement** limite a la supervision de l'infrastructure.
Les donnees capteurs ne sont pas affichees ici : elles sont consommees par
l'API et le modele IA (voir `INTERFACE_DEV.md`).

### Ajouter une donnee au tableau de bord

La source de verite est un fichier JSON, pas l'interface Grafana : on modifie
le fichier, on regenere, et le dashboard est a jour. Aucun clic, et c'est
versionne.

```bash
# 1. editer la liste des donnees a afficher
nano /opt/sentinel-x/grafana/spec-supervision.json
#    "actif": true/false  pour activer ou masquer une mesure

# 2. regenerer et recharger
python3 /opt/sentinel-x/scripts/gen-dashboard.py
docker compose -f /opt/sentinel-x/docker-compose.yml restart grafana
```

Chaque mesure y est decrite par sa section, son titre, son unite, la mesure
InfluxDB et les champs ou topics a afficher. Des exemples commentes sont
fournis dans le fichier `scripts/spec-supervision.json`.

## 6. Difficultes rencontrees

Consignees dans [INCIDENTS.md](INCIDENTS.md) — six pieges non documentes
dans la litterature, avec la correction appliquee et verifiee.

## 7. Contenu du dossier

| Fichier | Description |
|---------|-------------|
| `README.md` | Ce fichier : architecture et deploiement |
| `SECURITE.md` | Matrice de durcissement et plan d'adressage |
| `AUDIT.md` | Rapport d'audit — tests et resultats |
| `INCIDENTS.md` | Incidents, causes et corrections |
| `INTERFACE_DEV.md` | Ce que l'equipe DEV/IA doit savoir pour coder |
| `stack/` | Fichiers de configuration (sans secret) |
