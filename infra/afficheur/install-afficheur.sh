#!/usr/bin/env bash
#
# Installe l afficheur OLED et la protection batterie sur la borne.
# Relancable : chaque etape est idempotente, rien d existant n est ecrase
# (la configuration est conservee si elle existe deja).
#
# Usage : depuis le poste de dev
#   SUDO_PASSWORD_FILE=... bash repo/infra/afficheur/install-afficheur.sh
#
# Le script passe par SSH + sudo. Aucun secret n est affiche.

set -euo pipefail

ICI="$(cd "$(dirname "$0")" && pwd)"
HOTE="${DEPLOY_HOST:-sentinel-x12@192.168.100.2}"
CLE="${DEPLOY_KEY:-$HOME/.ssh/id_ed25519_rpi5}"
PORT="${DEPLOY_PORT:-2222}"
DISTANT="/opt/sentinel-afficheur"

travail="$(mktemp -d)"
trap 'rm -rf "$travail"' EXIT

install -d "$travail/sentinel-afficheur"
cp "$ICI"/*.py "$travail/sentinel-afficheur/"
cp "$ICI"/sentinel-*.service "$travail/sentinel-afficheur/"
tar --owner=root --group=root -czf "$travail/afficheur.tgz" -C "$travail" sentinel-afficheur

cat >"$travail/remote.sh" <<'DISTANT_SCRIPT'
set -e
install -d -m 0755 /opt/sentinel-afficheur
tar -xzf /tmp/afficheur.tgz -C /opt
install -d -m 0755 /etc/sentinel

# La configuration n est jamais ecrasee : on respecte ce que l operateur a regle.
if [ ! -f /etc/sentinel/afficheur.conf ]; then
  cat >/etc/sentinel/afficheur.conf <<'CONF'
# Reglages de l afficheur et de la protection batterie.
# Valeurs reprises au demarrage du service ; aucune n est secrete.

# Sous ce pourcentage : journal + sonde HTTP en 503 (Beszel alerte).
seuil_alerte = 25.0
# Sous celui-ci, de facon durable et sans recharge en cours : arret propre.
seuil_critique = 10.0
# Duree pendant laquelle il faut rester sous le seuil critique avant d agir.
delai_critique = 120
# Interdiction d arreter la borne trop tot apres un boot (anti-rebond).
delai_grace = 300
# Mettre non pour alerter sans jamais arreter la machine.
arret_auto = oui
# Petite sonde locale, en loopback uniquement : pour Beszel.
sonde_active = oui
sonde_port = 8099
CONF
  chmod 0644 /etc/sentinel/afficheur.conf
fi

cp /opt/sentinel-afficheur/sentinel-afficheur.service /etc/systemd/system/
cp /opt/sentinel-afficheur/sentinel-batterie.service /etc/systemd/system/
chmod 0644 /etc/systemd/system/sentinel-afficheur.service \
           /etc/systemd/system/sentinel-batterie.service
rm -f /opt/sentinel-afficheur/sentinel-*.service

systemctl daemon-reload
systemctl enable sentinel-afficheur.service sentinel-batterie.service >/dev/null
systemctl restart sentinel-afficheur.service
systemctl restart sentinel-batterie.service
rm -f /tmp/afficheur.tgz
DISTANT_SCRIPT

scp -q -i "$CLE" -P "$PORT" -o ConnectTimeout=8 "$travail/afficheur.tgz" "$HOTE:/tmp/afficheur.tgz"
scp -q -i "$CLE" -P "$PORT" -o ConnectTimeout=8 "$travail/remote.sh"   "$HOTE:/tmp/afficheur-install.sh"

if [ -n "${SUDO_PASSWORD_FILE:-}" ]; then
  MDPSUDO="$(cat "$SUDO_PASSWORD_FILE")"
else
  read -rsp "Mot de passe sudo sur la borne : " MDPSUDO; echo
fi

{ printf '%s\n' "$MDPSUDO"; } | ssh -i "$CLE" -p "$PORT" -o ConnectTimeout=8 "$HOTE" \
  "sudo -k; sudo -S bash /tmp/afficheur-install.sh; rm -f /tmp/afficheur-install.sh" 2>&1 \
  | MDPSUDO="$MDPSUDO" python3 -c 'import os,sys,re
secret = os.environ["MDPSUDO"]
t = sys.stdin.read().replace(secret, "[masque]")
t = re.sub(r"\[sudo\] password for [^:]*:", "", t)
sys.stdout.write(t)'

echo
echo "Afficheur installe dans $DISTANT :"
echo "  afficheur.py   boucle d affichage (boot puis pages)"
echo "  batterie.py    protection batterie + sonde locale"
echo "Configuration : /etc/sentinel/afficheur.conf (conservee si deja presente)"
