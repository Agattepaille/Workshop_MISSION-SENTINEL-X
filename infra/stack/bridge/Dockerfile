# Image du pont MQTT -> API Sentinel-X
#
# Memes choix que l image de l API : Node pinte, aucune dependance native (mqtt
# est pur JS), utilisateur non privilegie fourni par l image node.
#
# Le contexte de construction est la RACINE du deploiement (/opt/sentinel-x),
# comme pour l image de l API : les chemins commencent donc par stack/.

FROM node:24.21.0-bookworm-slim

ENV NODE_ENV=production

WORKDIR /app

COPY stack/bridge/package.json stack/bridge/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

COPY stack/bridge/src ./src

USER node

# Le pont n expose aucun port : c est lui qui se connecte au broker et a
# l API. Un HEALTHCHECK sur un processus sans HTTP passe donc par le fichier
# de sante qu il ecrit toutes les 5 s : fraicheur + etat de connexion.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "const s=JSON.parse(require('node:fs').readFileSync('/tmp/bridge-health.json','utf8'));process.exit(s.connected && Date.now()-s.updated_at < 60000 ? 0 : 1)"

CMD ["node", "src/index.js"]
