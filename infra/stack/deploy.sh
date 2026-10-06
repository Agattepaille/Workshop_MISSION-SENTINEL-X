#!/usr/bin/env bash
#
# Deploie la stack applicative sur la borne : copie les sources de l API et le
# compose dans /opt/sentinel-x, sans jamais transiter de secret.
#
# Usage : ./deploy.sh
# Le .env et secrets/admin-token.json ne sont PAS copies : ils sont generes une
# fois sur la borne (voir README.md, section "Premiere mise en service").

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HOST="sentinel-x12@192.168.100.2"
KEY="$HOME/.ssh/id_ed25519_rpi5"
PORT=2222
TARGET="/opt/sentinel-x"

work="$(mktemp -d)"
root="$work/sentinel-x"

# --- 1. Arborescence locale temporaire -------------------------------------
mkdir -p "$root/api" "$root/stack/api"

# Sources stricto sensu : pas de node_modules, pas de tests en production.
install -m 0644 "$REPO_ROOT/api/package.json" "$REPO_ROOT/api/package-lock.json" "$root/api/"
cp -r "$REPO_ROOT/api/src" "$REPO_ROOT/api/scripts" "$root/api/"
# Les fixtures restent livrees : le script d injection en a besoin au boot.
mkdir -p "$root/api/test"
cp -r "$REPO_ROOT/api/test/fixtures" "$root/api/test/"

# Fichiers INFRA.
cp "$REPO_ROOT/infra/stack/docker-compose.yml" "$root/stack/"
cp "$REPO_ROOT/infra/stack/.env.example"       "$root/stack/"
cp "$REPO_ROOT/infra/stack/.dockerignore"      "$root/"
cp "$REPO_ROOT/infra/stack/api/Dockerfile"     "$root/stack/api/"

archive="$work/sentinel-x-stack.tgz"
tar --owner=root --group=root -czf "$archive" -C "$work" sentinel-x

# --- 2. Transfert puis deploiement -----------------------------------------
scp -q -i "$KEY" -P "$PORT" -o ConnectTimeout=8 "$archive" "$HOST:/tmp/sentinel-x-stack.tgz"

ssh -i "$KEY" -p "$PORT" -o ConnectTimeout=8 "$HOST" \
  "sudo install -d -m 0755 /opt/sentinel-x && sudo tar -xzf /tmp/sentinel-x-stack.tgz -C /opt && "
  "sudo bash -c 'find /opt/sentinel-x -path /opt/sentinel-x/stack/secrets -prune -o -exec chown root:root {} + ; "
  "owner_ok=$(stat -c %u /opt/sentinel-x/stack/secrets/admin-token.json 2>/dev/null) ; "
  "[ -n \"$owner_ok\" ] && chown 1500:1500 /opt/sentinel-x/stack/secrets/admin-token.json && chmod 600 /opt/sentinel-x/stack/secrets/admin-token.json ; true' && "
  "rm -f /tmp/sentinel-x-stack.tgz"

rm -rf "$work"

echo "Deploie dans $TARGET :"
echo "  $TARGET/api      sources de l API"
echo "  $TARGET/stack    compose, Dockerfile, .env.example"
echo
echo "Si $TARGET/stack/.env n existe pas encore, le creer (chmod 600) avant 'docker compose up -d'."
