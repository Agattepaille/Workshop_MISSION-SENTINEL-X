# Les etapes du demarrage, telles qu elles existent vraiment sur cette borne
#
# Rien n est invente : chaque controle correspond a un service ou a un port
# reellement deploye (voir AGENTS.md section 2 et JOURNAL.md). Une etape peut
# etre "tolerante" : elle est affichee, mais son echec n empeche pas le STATUT
# OK final. C est le cas du Wi-Fi client et du tunnel : sans partage de
# connexion, la borne fonctionne quand meme, il faut seulement le savoir.

import ipaddress
import socket
import subprocess
import time
import urllib.request


def commande(arguments, delai=3.0):
    """Lance une commande et renvoie sa sortie, ou None si elle echoue."""
    try:
        resultat = subprocess.run(
            arguments,
            capture_output=True,
            text=True,
            timeout=delai,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if resultat.returncode != 0:
        return None
    return resultat.stdout


def _actif(*services):
    sortie = commande(["systemctl", "is-active", *services])
    if sortie is None:
        return False
    etats = sortie.strip().splitlines()
    return len(etats) == len(services) and all(e == "active" for e in etats)


def _uap0():
    sortie = commande(["ip", "-br", "addr", "show", "dev", "uap0"])
    return bool(sortie and "10.73.42.1/29" in sortie)


def _wifi():
    sortie = commande(["nmcli", "-t", "-f", "DEVICE,STATE", "device", "status"])
    return bool(sortie and "wlan0:connected" in sortie)


def _heure():
    sortie = commande(["chronyc", "-c", "tracking"])
    if not sortie:
        return False
    champs = sortie.strip().split(",")
    # chronyc -c : ref_id, adresse, stratum, ... ; 00000000 = non synchronise
    return bool(champs) and champs[0] not in ("00000000", "")


def _docker():
    return _actif("docker") and commande(["docker", "info", "--format", "ok"]) is not None


def conteneurs():
    """Compte les conteneurs :  demarres / total, et sante explicite.

    Attention au piege : la colonne Status vaut 'Up 3 minutes' ou 'Up 3 minutes
    (healthy)'. Il n y a JAMAIS de parenthese devant Up, contrairement a ce
    qu on ecrit trop vite : on teste donc le debut de la chaine.
    """
    sortie = commande(
        ["docker", "ps", "--format", "{{.Names}}|{{.Status}}"], delai=5.0
    )
    if not sortie:
        return False, (0, 0)
    lignes = [l for l in sortie.strip().splitlines() if l]
    sains = 0
    for ligne in lignes:
        _, _, etat = ligne.partition("|")
        if etat.startswith("Up") and "unhealthy" not in etat:
            sains += 1
    total = len(lignes)
    return total > 0 and sains == total, (sains, total)


def _port_ouvert(hote, port, delai=1.5):
    with socket.socket() as prise:
        prise.settimeout(delai)
        try:
            prise.connect((hote, port))
        except OSError:
            return False
        return True


def _http(reponse_attendue=200):
    try:
        with urllib.request.urlopen(
            "http://127.0.0.1:3000/api/v1/alerts?limit=1", timeout=2
        ) as reponse:
            return reponse.status == reponse_attendue
    except Exception:
        return False


ETAPES = [
    # identifiant, libelle court (6 caracteres au maximum), controle, tolerant
    ("uap0", "uap0", _uap0, False),
    ("wifi", "wifi", _wifi, True),
    ("ap", "AP", lambda: _actif("hostapd", "dnsmasq"), False),
    ("heure", "heure", _heure, True),
    ("docker", "docker", _docker, False),
    ("conteneurs", "ctn", lambda: conteneurs()[0], False),
    # Le broker n ecoute QUE sur le reseau des cartes : c est donc ce
    # port-la qu on controle, pas une boucle locale qui n existe pas.
    ("mqtt", "mqtt", lambda: _port_ouvert("10.73.42.1", 8883), False),
    ("api", "api", _http, False),
    ("supervision", "beszel", lambda: _actif("beszel", "beszel-agent"), False),
    ("tunnel", "tunnel", lambda: _actif("cloudflared"), True),
]

DETAIL_CONTENEURS = conteneurs


class Suivi:
    """Evalue les etapes et garde leur etat entre deux passages."""

    def __init__(self, delai_echec=150):
        self.depart = time.monotonic()
        self.delai_echec = delai_echec
        self.etat = {identifiant: None for identifiant, *_ in ETAPES}

    def evaluer(self):
        resultats = {}
        for identifiant, libelle, controle, tolerant in ETAPES:
            try:
                resultats[identifiant] = bool(controle())
            except Exception:
                resultats[identifiant] = False
        self.etat = resultats
        return resultats

    def resume(self):
        """Etat affichable : OK, .. en cours, KO en echec, ! avertissement."""
        ecoule = time.monotonic() - self.depart
        expire = ecoule > self.delai_echec
        ordre = [identifiant for identifiant, *_ in ETAPES]
        sortie = []
        for position, (identifiant, libelle, _, tolerant) in enumerate(ETAPES):
            if self.etat.get(identifiant):
                marque = "OK"
            else:
                suivant_ok = any(
                    self.etat.get(autre) for autre in ordre[position + 1 :]
                )
                # Un service encore attendu n est pas un echec : on ne le
                # marque KO qu une fois le demarrage termine ou depasse.
                if suivant_ok or expire:
                    marque = "!" if tolerant else "KO"
                else:
                    marque = ".."
            sortie.append((libelle, marque, tolerant))
        return sortie

    def termine(self):
        for (identifiant, _, _, tolerant) in ETAPES:
            if tolerant:
                continue
            if not self.etat.get(identifiant):
                return False
        return True

    def progression(self):
        total = len([e for e in ETAPES if not e[3]])
        faits = len([e for e in ETAPES if not e[3] and self.etat.get(e[0])])
        return faits, total
