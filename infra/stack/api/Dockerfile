# Image de l API Sentinel-X — construite depuis ./api (source) du repertoire parent.
#
# Base : Node 24 sur Debian slim, version PINCEE (aucune image "latest").
# Aucune dependance native : le client InfluxDB 3 est pur JS, pas de toolchain
# a installer, d'ou une image de construction legere.

FROM node:24.21.0-bookworm-slim

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

WORKDIR /app

# Les dependances d'abord : cette couche est reutilisee quand seul le code change.
COPY api/package.json api/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

COPY api/src ./src
COPY api/scripts ./scripts
# Fixtures uniquement : le script d injection de jeu d essai les lit au demarrage.
COPY api/test/fixtures ./test/fixtures

# L utilisateur non privilegie fourni par l image node : aucun proces root.
USER node

EXPOSE 3000

# L API n a pas de route /health (voir api/README.md). On sonde donc une lecture
# reelle : elle echoue si le serveur est mort MAIS AUSSI si la base est injoignable,
# ce qui est exactement la definition d "operationnel" pour nous.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('node:http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/v1/alerts',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "src/server.js"]
