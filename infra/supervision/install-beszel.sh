#!/usr/bin/env bash
#
# Installation de la supervision de la borne : Beszel hub + agent (v0.21.0).
# A executer en root sur le Raspberry Pi. Idempotent.
#
# Choix : binaires Go + unites systemd, sans Docker.
#   - la microSD n'encaisse pas les ecritures d'un InfluxDB/Netdata
#   - la supervision doit rester disponible meme si la stack Compose tombe
#
# Aucun secret dans ce script : le mot de passe du hub est cree hors bande.

set -euo pipefail

VERSION="${VERSION:-0.21.0}"
ARCH="arm64"
BIN_DIR="/opt/beszel"
BIN_AGENT_DIR="/opt/beszel-agent"
HUB_DATA="/var/lib/beszel"
AGENT_CONF="/etc/beszel-agent"

# --- 1. Telechargement et verification d'integrite -------------------------
workdir="$(mktemp -d)"
cd "$workdir"

# Les noms d'origine sont conserves : sha256sum -c verifie les noms listes
# dans le fichier de sommes, pas des chemins arbitraires.
base="https://github.com/henrygd/beszel/releases/download/v${VERSION}"
curl -fsSL -O "${base}/beszel_linux_${ARCH}.tar.gz"
curl -fsSL -O "${base}/beszel-agent_linux_${ARCH}.tar.gz"
curl -fsSL -O "${base}/beszel_${VERSION}_checksums.txt"

grep "linux_${ARCH}.tar.gz" "beszel_${VERSION}_checksums.txt" | sha256sum -c -

tar -xzf "beszel_linux_${ARCH}.tar.gz"       beszel
tar -xzf "beszel-agent_linux_${ARCH}.tar.gz" beszel-agent

# --- 2. Comptes systeme dedies --------------------------------------------
# Le hub et l'agent n'ont aucune raison de partager un utilisateur, ni d'avoir
# un shell.
id -u beszel        >/dev/null 2>&1 || useradd --system --shell /usr/sbin/nologin --home-dir "$HUB_DATA" --user-group beszel
id -u beszel-agent  >/dev/null 2>&1 || useradd --system --shell /usr/sbin/nologin --home-dir "$BIN_AGENT_DIR" --user-group beszel-agent

# --- 3. Binaires ----------------------------------------------------------
install -d -m 0755 "$BIN_DIR" "$BIN_AGENT_DIR" "$HUB_DATA" "$AGENT_CONF"
install -m 0750 -o root -g beszel       beszel       "$BIN_DIR/beszel"
install -m 0750 -o root -g beszel-agent beszel-agent "$BIN_AGENT_DIR/beszel-agent"

chown -R beszel:beszel "$HUB_DATA"
chmod 0750 "$HUB_DATA"

# Le repertoire doit rester traversable par l'agent (sinon "permission denied"
# sur la cle, meme en 640) tout en restant illisible pour les autres.
chown root:beszel-agent "$AGENT_CONF"
chmod 0750 "$AGENT_CONF"

# --- 4. Unites systemd ----------------------------------------------------
# Regle du projet : aucune exposition en 0.0.0.0. Le hub n'ecoute que sur la
# loopback ; l'acces distant passe par le tunnel Cloudflare, pas par le reseau.
cat >/etc/systemd/system/beszel.service <<'UNIT'
[Unit]
Description=Beszel Hub - supervision de la borne Sentinel-X
Documentation=https://beszel.dev
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=beszel
Group=beszel
WorkingDirectory=/var/lib/beszel
ExecStart=/opt/beszel/beszel serve --http "127.0.0.1:8090"
Restart=always
RestartSec=5

NoNewPrivileges=yes
PrivateTmp=yes
ProtectHome=yes
ProtectSystem=strict
ProtectKernelLogs=yes
ProtectControlGroups=yes
RestrictSUIDSGID=true
ReadWritePaths=/var/lib/beszel

[Install]
WantedBy=multi-user.target
UNIT

cat >/etc/systemd/system/beszel-agent.service <<'UNIT'
[Unit]
Description=Beszel Agent - collecte des metriques de la borne
Documentation=https://beszel.dev
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=beszel-agent
Group=beszel-agent
ExecStart=/opt/beszel-agent/beszel-agent
Environment="LISTEN=127.0.0.1:45876"
Environment="KEY_FILE=/etc/beszel-agent/key"
Environment="TOKEN_FILE=/etc/beszel-agent/token"
Restart=on-failure
RestartSec=5
StateDirectory=beszel-agent

NoNewPrivileges=yes
PrivateTmp=yes
ProtectHome=yes
ProtectSystem=strict
ProtectKernelLogs=yes
ProtectControlGroups=yes
RestrictSUIDSGID=true

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable beszel.service

echo "OK : binaires en place, unites installees."
echo "Hub   : /opt/beszel/beszel      (donnees dans $HUB_DATA)"
echo "Agent : $BIN_AGENT_DIR/beszel-agent (cle et jeton dans $AGENT_CONF)"

rm -rf "$workdir"
