# Supervision de la borne — Beszel

Surveillance du **Raspberry Pi lui-même** (CPU, RAM, disque, réseau,
température, charge, services systemd) avec [Beszel](https://beszel.dev)
v0.21.0.

Ce dossier ne supervise **ni Mosquitto, ni les conteneurs applicatifs** : leur
monitoring viendra avec la refonte de la stack.

---

## Pourquoi Beszel et pas Grafana + InfluxDB + Telegraf

| Critère | Grafana + InfluxDB + Telegraf | Beszel (ce déploiement) |
|---|---|---|
| Empattement mémoire | ~600 Mo à 1 Go | **~35 Mo** (hub + agent) |
| Écriture sur la microSD | importante (base temporelle) | **~5 Mo/jour**, SQLite local |
| Services à maintenir | 3 (+ provisionning) | 2 (hub, agent) |
| Temps de mise en œuvre | plusieurs heures | ~30 min, scriptable |
| Historique | selon configuration InfluxDB | 30 jours par défaut |
| Alertes | Alertmanager/Grafana | **intégrées** (seuils) |

Le facteur décisif reste le support : une base temporelle écrit en continu sur
une carte SD. Beszel stocke peu et ne dépend d'aucun moteur externe.

## Décision du 06/10/2026 : l'agent reste un binaire systemd

Le hub comme l'agent existent en image Docker. **Les deux restent des binaires
pilotés par systemd**, et c'est un choix assumé, pas un pis-aller.

| Besoin | Conteneur | Binaire systemd |
|---|---|---|
| Température CPU, ventilateur, S.M.A.R.T. | indisponible ou à configurer en rootless (`/sys`, `cgroup` non délégués) | **lu directement** |
| Surveillance des services systemd de la borne | hors de portée | **native** |
| Disponibilité si la stack Docker tombe | dépend de Docker, absent aujourd'hui | **indépendant** |
| Empreinte | runtime + image (~30 Mo) | ~17 Mo, sans runtime |

La supervision doit rester la dernière chose à mourir sur cette machine : elle
sert précisément à constater que le reste est tombé. La faire dépendre du
moteur qu'elle surveille serait un contresens.

Corollaire pour la refonte : quand Docker reviendra, le **hub** pourra être
conteneurisé sans dommage (il n'interroge que la loopback), mais l'**agent** ne
bougera pas. Aucune donnée système ne doit dépendre d'un conteneur.

## Architecture

```
127.0.0.1:8090   beszel.service         hub : dashboard + API + SQLite
                                          données dans /var/lib/beszel/beszel_data
      ^  (le hub interroge l'agent, flux sortant uniquement)
127.0.0.1:45876  beszel-agent.service   agent : collecte, mini serveur SSH interne
                                          clé  : /etc/beszel-agent/key
                                          jeton: /etc/beszel-agent/token
```

**Aucune des deux unités n'écoute en `0.0.0.0`** (invariant 3 du projet).
L'accès distant se fait soit par le tunnel Cloudflare, soit par un
réacheminement SSH — jamais par une ouverture réseau sur la borne.

## Installation

```bash
# en root sur la borne, depuis une copie de ce dépôt
VERSION=0.21.0 bash install-beszel.sh
```

Le script télécharge les binaires `linux/arm64`, **vérifie les sommes SHA256**
publiées par l'éditeur, crée deux comptes système dédiés sans shell, pose les
unités systemd durcies et active `beszel.service`. Version pinnée : jamais
`latest` sur une démo notée.

La configuration applicative (compte du hub, clé et jeton de l'agent) reste
**hors dépôt** : valeurs dans `CREDENTIALS.md`. Voir la section
« Mise en service sans interface web » ci-dessous.

## Accès au tableau de bord

- **Via le tunnel** : route « Published application » du tunnel Sentinel-X →
  `http://127.0.0.1:8090` (à faire dans le tableau de bord Zero Trust).
- **Sans tunnel** (accès immédiat) : `ssh -L 18090:127.0.0.1:8090 -p 2222 …`
  puis `http://127.0.0.1:18090`.

## Alertes configurées

| Alerte | Seuil | Délai |
|---|---|---|
| `Disk` | > 85 % | 5 min |
| `Memory` | > 85 % | 5 min |
| `Temperature` | > 75 °C | 5 min |
| `LoadAvg5` | > 4 | 5 min |
| `Status` | borne injoignable | 5 min |

Modifiables depuis l'interface (onglet Alerts) ou par l'API REST.

## Unités des métriques reçues par l'API

Piège rencontré : le champ `info` n'est pas homogène. `cpu`, `mp`, `dp` sont
des **pourcentages**, `u` est l'**uptime en secondes**, `la` la charge
moyenne. Une conversion naïve des premiers en Go affiche « 0,0 Go ».

## Exploitation courante

```bash
systemctl status beszel beszel-agent          # état des deux services
journalctl -u beszel-agent -f                 # collecte en direct
/opt/beszel/beszel health                     # sonde du hub
/opt/beszel/beszel superuser update <email>   # changement de mot de passe
du -sh /var/lib/beszel/beszel_data            # volumétrie de l'historique
```

Mise à jour : `VERSION=x.y.z bash install-beszel.sh` (les données sont
conservées dans `/var/lib/beszel`, les binaires écrasés).

## Mise en service sans interface web

Le hub est un PocketBase : compte, système et jeton se créent par l'API. Utile
quand la borne n'est accessible qu'en SSH. Procédure éprouvée le 06/10/2026 :

```bash
# 1. compte administrateur (attention : voir piège ci-dessous)
sudo -u beszel /opt/beszel/beszel superuser upsert <email> <mdp> \
  --dir /var/lib/beszel/beszel_data

# 2. clé publique du hub, à déposer dans /etc/beszel-agent/key
ssh-keygen -y -f /var/lib/beszel/beszel_data/id_ed25519

# 3. puis, via http://127.0.0.1:8090/api/ (après ssh -L) :
#    POST /api/collections/_superusers/auth-with-password   -> jeton de session
#    POST /api/collections/users/records                    -> utilisateur
#    POST /api/collections/systems/records   {name,host,port,users:[id]}
#    POST /api/collections/fingerprints/records {system:id, token:<32 hex>}
```

Le système n'apparaît **« up »** qu'une fois la clé et le jeton posés et
l'agent redémarré.

### Deux pièges déjà payés

- **`superuser upsert` réécrit un e-mail jugé invalide** : `sentinel-x@local`
  est devenu `_@b.b` dans la base, et l'authentification échouait en boucle.
  Utiliser un domaine réel (`borne.local`).
- **Le répertoire de l'agent doit être traversable** : une clé en `640` avec un
  parent en `0750 root:root` donne `permission denied`. D'où le
  `chown root:beszel-agent` dans le script.
