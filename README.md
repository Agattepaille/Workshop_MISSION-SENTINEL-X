# SENTINEL-X

Prototype de surveillance autonome qui relie des capteurs, une caméra et un
dashboard de supervision. Le firmware est prévu pour collecter les données des
capteurs, l’API les reçoit et les enregistre dans InfluxDB, et le dashboard
présente les mesures et les événements de détection.

## Démarrage rapide

### Prérequis

- Node.js 20 ou version ultérieure et npm
- InfluxDB 3 Core démarré et accessible
- Un broker MQTT, uniquement si vous souhaitez piloter les équipements
- Le service de vision et une webcam, uniquement pour la prévisualisation et
  l’enregistrement des événements caméra

### 1. Configurer et démarrer l’API

Dans un terminal :

```sh
cd api
npm install
cp .env.example .env
```

Dans `api/.env`, renseignez le jeton InfluxDB (`INFLUX_TOKEN`) et vérifiez le
nom de la base (`INFLUX_DATABASE`, `alerts` par défaut). Cette base doit déjà
exister dans InfluxDB 3 Core. Puis lancez l’API :

```sh
npm start
```

Par défaut, l’API est disponible à `http://127.0.0.1:3000`.

### 2. Démarrer le dashboard

Dans un second terminal :

```sh
cd dashboard
npm install
npm run dev
```

Ouvrez l’adresse affichée par Vite, généralement
[`http://localhost:5173`](http://localhost:5173). En développement, Vite
transmet automatiquement les requêtes `/api` et les connexions `/ws` à l’API
locale.

> L’API n’a pas encore d’authentification. Gardez-la sur le réseau local de
> confiance et ne l’exposez pas directement à Internet.

## Fonctionnalités

- **Mesures et alertes** : l’API reçoit les alertes des équipements et les
  conserve dans InfluxDB.
- **Événements caméra** : le dashboard enregistre un événement au premier
  relevé positif après une absence, puis attend une nouvelle absence avant d’en
  enregistrer un autre. Le plus récent apparaît dans la carte **Dernier
  événement**. L’événement conserve des métadonnées, pas d’image. Son
  horodatage correspond à l’observation du dashboard, dont l’interrogation de
  la vision est périodique.
- **Commandes d’équipement** : le dashboard peut envoyer des commandes via
  MQTT lorsque le broker et les identifiants des équipements sont configurés.

Les composants optionnels ne sont pas nécessaires pour démarrer l’API et le
dashboard. Pour les contrats, paramètres et procédures détaillés, consultez
les guides ci-dessous.

## Guides par composant

| Dossier                             | Description et documentation                                      |
| ----------------------------------- | ----------------------------------------------------------------- |
| [`api/`](api/README.md)             | API Node.js : routes REST, événements, InfluxDB, MQTT et tests    |
| [`dashboard/`](dashboard/README.md) | Interface web, configuration, affichage des alertes et événements |
| [`firmware/`](firmware/README.md)   | Micrologiciel ESP8266 et configuration PlatformIO                 |
| [`ia/`](ia/README.md)               | Scripts de vision par webcam et de maintenance prédictive         |
| [`infra/`](infra/README.md)         | Conteneurs, broker MQTT et configuration de l’infrastructure      |

## Vérifications du code

Installez les dépendances de développement à la racine pour ESLint, Prettier et
les hooks Git :

```sh
npm install
```

Commandes de vérification disponibles à la racine :

```sh
npm run check          # lint et tests de l’API
npm run format:check   # vérifie le formatage
npm run lint           # lint de l’API
npm test               # tests de l’API
```

Pour vérifier le dashboard :

```sh
npm --prefix dashboard run lint
npm --prefix dashboard run build
```

Les hooks Husky sont installés par `npm install`. Si nécessaire, réinstallez-les
avec `npm run prepare`.
