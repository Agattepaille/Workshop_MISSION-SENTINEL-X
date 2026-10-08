# Le MQTT côté dashboard (React / Node)

Destiné au pilier **DEV**, volet interface (`dashboard/`). Écrit depuis `infra/` :
il décrit le service disponible, pas l'architecture de l'interface.

---

## 1. Ce que le dashboard a déjà, sans rien changer

`src/hooks/useAlerts.ts` consomme aujourd'hui deux canaux servis par **l'API** :

| Canal | Adresse | Rôle |
|---|---|---|
| REST | `GET /api/v1/alerts?limit=50` | instantané au chargement |
| WebSocket | `ws(s)://<hôte>/ws` | poussée `{ type: "alert.created", data: … }` |

En développement, `vite.config.ts` redirige `/api` et `/ws` vers
`http://127.0.0.1:3000`. **Les mesures des cartes arrivent donc déjà en temps
réel** : une carte publie → le pont écrit via l'API → l'API pousse sur `/ws` →
la grille se met à jour.

**Conclusion court terme : aucune modification n'est nécessaire pour voir les
mesures.** Le MQTT direct ne se justifie que si le dashboard a besoin de données
que l'API ne stocke pas (trame brute, état d'un actionneur, `$SYS` du broker).

## 2. Ce que le broker met à disposition, et à quelles conditions

| Écouteur | Adresse | Public | Protocole |
|---|---|---|---|
| MQTTS | `10.73.42.1:8883` | les cartes | MQTT sur TLS |
| MQTT/WebSocket **TLS** | `127.0.0.1:8884` | le dashboard | `wss` |

Un navigateur ne sait pas ouvrir du MQTT brut : d'où l'écouteur WebSocket. Deux
conséquences à connaître avant de câbler quoi que ce soit :

1. **`8884` n'écoute que sur la loopback de la borne.** Rien ne peut s'y
   connecter depuis le réseau de la table, ni depuis l'extérieur. Depuis le
   poste de dev, il faut un tunnel :
   `ssh -L 8884:127.0.0.1:8884 -p 2222 sentinel-x12@192.168.100.2`.
2. **Une autorité privée n'est pas connue du magasin de certificats** du
   système ou du navigateur : un `new WebSocket("wss://…")` vers ce port échoue
   la validation TLS, exactement comme un HTTPS auto-signé. Deux issues :
   importer `config/mosquitto-ca.crt` dans le magasin de la machine, **ou**
   faire la connexion côté Node, où la CA se passe explicitement (solution
   retenue ci-dessous).

## 3. Le chemin retenu : un relais Node, CA explicite

Snippet **vérifié sur la borne** (Node 24 + `mqtt@5.14.1`, la même version que
le pont) :

```js
import fs from "node:fs";
import mqtt from "mqtt";

const client = mqtt.connect("wss://127.0.0.1:8884", {
  username: "api",                       // ou "bridge" : lecture seule
  password: process.env.MQTT_PASSWORD,   // CREDENTIALS.md, jamais dans Git
  ca: fs.readFileSync("/opt/sentinel-x/stack/mosquitto/certs/ca.crt"),
  servername: "localhost",               // le certificat porte DNS:localhost
  rejectUnauthorized: true,              // ne jamais mettre false
});

client.on("connect", () => client.subscribe("sentinel/table/sensors/#", { qos: 1 }));
client.on("message", (topic, payload) => {
  // topic = sentinel/table/sensors/<device_id>[/<grandeur>]
  // payload = JSON (trame structurée, objet plat) ou nombre nu
});
```

Résultat mesuré lors de la mise en service :

```
connecte
RECU sentinel/table/sensors/esp8266-node {"temperature_c":27.2,"humidity_pct":48}
```

Vérifié aussi avec un client Python (`paho-mqtt`, transport `websockets`), même
résultat : le portail n'est pas lié à une bibliothèque précise.

Forme des trames : voir `guide-connexion-esp.md`, section 4. Rappel utile —
`device_id` vient du topic, **jamais** de la charge utile.

## 4. Quel utilisateur utiliser

| Compte | Droits | À utiliser pour |
|---|---|---|
| `bridge` | **lecture seule** de `sensors/#` | un affichage ou un relais qui ne publie rien |
| `api` | `sensors/#` en lecture, `actuators/#` en écriture | publier un ordre (allumer un actionneur) depuis le serveur |

Le compte `esp` est celui des **cartes**, il ne doit pas servir ailleurs.

## 5. Interdits

- **`rejectUnauthorized: false`** : désactiver la vérification revient à
  annuler le chiffrement pour un attaquant en homme du milieu.
- **Exposer `8884` ailleurs que la loopback.** Aucun port en `0.0.0.0`
  (invariant du projet).
- **Un mot de passe dans le dépôt.** `.gitignore` bloque déjà `.env*` : passer
  par les variables d'environnement, valeurs dans `CREDENTIALS.md`.
- **Doubler la lecture des mesures.** Les lire à la fois via `/ws` et via MQTT
  fait deux sources de vérité pour un même écran.

## 6. État de vérification

| Élément | État |
|---|---|
| Connexion Node `mqtt@5.14.1` en `wss` avec CA privée, abonnement, réception | **vérifié sur la borne** |
| Idem en Python `paho-mqtt` | **vérifié sur la borne** |
| Refus depuis le réseau de la table (`8884` en loopback) | **vérifié** (`ss`, `nmap`) |
| Comportement exact d'un navigateur sans CA importée | **non vérifié** (pas de navigateur lors des essais) : c'est la règle TLS habituelle |
| Intégration dans `dashboard/` (composant, état React) | **non fait** : choix de l'équipe DEV |
