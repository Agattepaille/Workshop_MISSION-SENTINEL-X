# Workshop MISSION SENTINEL-X

Prototype de boîtier de surveillance autonome : un ESP8266 collecte les données
des capteurs, le PC Serveur Local les centralise via une API, un dashboard les
supervise et des scripts IA analysent la vidéo et les séries temporelles.

## Structure du dépôt

| Dossier                             | Rôle                                                                                          |
| ----------------------------------- | --------------------------------------------------------------------------------------------- |
| [`api/`](api/README.md)             | API Node.js : réception des alertes (`POST /api/v1/alerts`), persistance, diffusion WebSocket |
| [`dashboard/`](dashboard/README.md) | Interface web de supervision                                                                  |
| [`firmware/`](firmware/README.md)   | Micrologiciel C++ de l’ESP8266 (PlatformIO)                                                   |
| [`ia/`](ia/README.md)               | Scripts Python : vision par webcam et maintenance prédictive                                  |
| [`infra/`](infra/README.md)         | Configuration de l’infrastructure serveur (conteneurs, broker MQTT, base de données)          |

## Démarrer l’API

```sh
cd api
npm install
npm start
```

L’API écoute par défaut sur `http://127.0.0.1:3000`. Voir
[`api/README.md`](api/README.md) pour le contrat des alertes, les tests et le
jeu de données d’exemple.

## Vérifications du code

Installez les dépendances de développement à la racine du dépôt pour activer
ESLint et les hooks Git Husky :

```sh
npm install
```

ESLint vérifie les fichiers JavaScript de l’API. Le hook `pre-commit` lance le
lint, et le hook `pre-push` lance le lint et les tests de l’API. Ces mêmes
vérifications peuvent être exécutées manuellement avec :

```sh
npm run format:check
npm run lint
npm test
npm run check
```

Les hooks sont installés automatiquement par `npm install`. Si le dépôt est
cloné ou que l’environnement Git est recréé après l’installation, exécutez
`npm run prepare` à la racine pour les réinstaller.
