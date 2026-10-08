#!/usr/bin/env bash
#
# Deploie la stack applicative sur la borne : copie les sources de l API et le
# compose dans /opt/sentinel-x, sans jamais transiter de secret.
#
# Usage : ./deploy.sh
# Le .env et secrets/admin-token.json ne sont PAS copies : ils sont generes une
# fois sur la borne (voir README.md, section "Premiere mise en service").
#
# Mot de passe sudo : demande une seule fois, jamais affiche. Il n est pas lu
# dans CREDENTIALS.md par ce script (saisie interactive) pour rester utilisable
# hors du poste de dev.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HOST="${DEPLOY_HOST:-sentinel-x12@192.168.100.2}"
KEY="${DEPLOY_KEY:-$HOME/.ssh/id_ed25519_rpi5}"
PORT="${DEPLOY_PORT:-2222}"
REMOTE_DIR="/opt/sentinel-x"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
root="$work/sentinel-x"

# --- 1. Arborescence locale temporaire -------------------------------------
mkdir -p "$root/api" "$root/stack/api"

# Sources : pas de node_modules, pas de tests unitaires en production.
install -m 0644 "$REPO_ROOT/api/package.json" "$REPO_ROOT/api/package-lock.json" "$root/api/"
cp -r "$REPO_ROOT/api/src" "$REPO_ROOT/api/scripts" "$root/api/"
# Les fixtures restent livrees : le script d injection de jeu d essai les lit.
mkdir -p "$root/api/test"
cp -r "$REPO_ROOT/api/test/fixtures" "$root/api/test/"

# Fichiers INFRA.
cp "$REPO_ROOT/infra/stack/docker-compose.yml" "$root/stack/"
cp "$REPO_ROOT/infra/stack/.env.example"       "$root/stack/"
cp "$REPO_ROOT/infra/stack/.dockerignore"      "$root/"
cp "$REPO_ROOT/infra/stack/api/Dockerfile"     "$root/stack/api/"
# Configuration du broker (aucun secret : les mots de passe et certificats
# sont generes une fois sur la borne).
mkdir -p "$root/stack/mosquitto"
cp "$REPO_ROOT/infra/stack/mosquitto/mosquitto.conf" "$root/stack/mosquitto/"
cp "$REPO_ROOT/infra/stack/mosquitto/acl"            "$root/stack/mosquitto/"

# Pont MQTT -> API : code, manifeste ET verrou de dependances (le build fait
# un "npm ci", il echouerait sans le fichier).
mkdir -p "$root/stack/bridge/src"
cp "$REPO_ROOT/infra/stack/bridge/Dockerfile"      "$root/stack/bridge/"
cp "$REPO_ROOT/infra/stack/bridge/package.json"    "$root/stack/bridge/"
cp "$REPO_ROOT/infra/stack/bridge/package-lock.json" "$root/stack/bridge/"
cp "$REPO_ROOT/infra/stack/bridge/src/index.js"    "$root/stack/bridge/src/"

archive="$work/sentinel-x-stack.tgz"
tar --owner=root --group=root -czf "$archive" -C "$work" sentinel-x

# --- 2. Script execute cote borne ------------------------------------------
# Passe par un fichier : un heredoc sur stdin etait avale par la lecture du mot
# de passe sudo.
remote="$work/deploy-remote.sh"
cat >"$remote" <<'REMOTE'
set -e
install -d -m 0755 /opt/sentinel-x
tar -xzf /tmp/sentinel-x-stack.tgz -C /opt
find /opt/sentinel-x -path /opt/sentinel-x/stack/secrets -prune -o -path /opt/sentinel-x/stack/mosquitto -prune -o -exec chown root:root {} +
if [ -f /opt/sentinel-x/stack/secrets/admin-token.json ]; then
  chown 1500:1500 /opt/sentinel-x/stack/secrets/admin-token.json
  chmod 600        /opt/sentinel-x/stack/secrets/admin-token.json
fi
rm -f /tmp/sentinel-x-stack.tgz
REMOTE

# --- 3. Transfert puis execution -------------------------------------------
scp -q -i "$KEY" -P "$PORT" -o ConnectTimeout=8 "$archive" "$HOST:/tmp/sentinel-x-stack.tgz"
scp -q -i "$KEY" -P "$PORT" -o ConnectTimeout=8 "$remote"  "$HOST:/tmp/sentinel-x-deploy.sh"

# Le mot de passe sudo : saisie interactive par defaut, ou fichier (600) pour
# un deploiement automatise. Il n'est jamais affiche.
if [ -n "${SUDO_PASSWORD_FILE:-}" ]; then
  PW="$(cat "$SUDO_PASSWORD_FILE")"
else
  read -rsp "Mot de passe sudo sur la borne : " PW; echo
fi

{ printf '%s\n' "$PW"; } | ssh -i "$KEY" -p "$PORT" -o ConnectTimeout=8 "$HOST" \
  "sudo -k; sudo -S bash /tmp/sentinel-x-deploy.sh; rm -f /tmp/sentinel-x-deploy.sh" 2>&1 \
  | PW_SECRET="$PW" python3 -c 'import os,sys,re
t = sys.stdin.read()
t = re.sub(r"\[sudo\] password for [^:]*:", "", t)
sys.stdout.write(t.replace(os.environ["PW_SECRET"], "[masque]"))'

echo "Deploie dans $REMOTE_DIR :"
echo "  $REMOTE_DIR/api            sources de l API"
echo "  $REMOTE_DIR/stack          compose, Dockerfiles, .env.example"
echo "  $REMOTE_DIR/stack/mosquitto configuration du broker (sans secret)"
echo "  $REMOTE_DIR/stack/bridge   pont MQTT -> API"
echo
echo "Secrets preserves : .env et stack/secrets ne sont jamais ecrases."
