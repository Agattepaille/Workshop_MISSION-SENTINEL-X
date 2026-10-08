# Mise en page des ecrans
#
# Tout se joue sur 128x64 pixels, soit 8 lignes de 8 pixels et 21 caracteres
# par ligne avec la police 5x7. C est peu : chaque ligne est donc pesee.
# Le meme module sert a l ecran physique et a l apercu en mode sec.

import datetime
import time

import etapes
import oled

LIGNES = oled.OLED.HAUTEUR // 8          # 8
COLONNES = oled.OLED.LARGEUR // 6        # 21 caracteres par ligne


def _ligne(tampon, rang, texte, decalage=0):
    tampon.texte(0, rang * 8 + decalage, texte[:COLONNES])


def _barre(tampon, rang, faits, total, decalage=0):
    largeur = COLONNES * 6 - 2
    cases = max(total, 1)
    remplies = int(round(largeur * faits / cases))
    y = rang * 8 + decalage + 3
    tampon.rectangle(0, y - 3, largeur, 5)
    for i in range(remplies):
        tampon.pixel(1 + i, y - 1, True)
        tampon.pixel(1 + i, y, True)
        tampon.pixel(1 + i, y + 1, True)


def _ip(interface):
    import subprocess

    try:
        sortie = subprocess.run(
            ["ip", "-br", "addr", "show", "dev", interface],
            capture_output=True,
            text=True,
            timeout=2,
        ).stdout
    except OSError:
        return "-"
    for bloc in sortie.split():
        if "/" in bloc and not bloc.startswith("fe80"):
            return bloc.split("/")[0]
    return "-"


def boot(tampon, resume, progression, secondes, decalage=0):
    """Toutes les etapes en meme temps, deux par ligne.

    Le compte est court : 21 caracteres par ligne, 8 lignes. Deux etapes par
    ligne permettent d'afficher les dix d'un coup, ce qui est tout l'interet
    d'un afficheur de demarrage : voir ce qui est fait ET ce qui reste.
    """
    tampon.effacer()
    faits, total = progression
    entete = "DEMARRAGE %3ds %d/%d" % (int(secondes), faits, total)
    _ligne(tampon, 0, entete, decalage)
    _barre(tampon, 1, faits, total, decalage)

    for rang in range(6):
        paire = resume[rang * 2 : rang * 2 + 2]
        if not paire:
            break
        texte = ""
        for libelle, marque, _ in paire:
            texte += "%-6.6s %-2s " % (libelle, marque)
        _ligne(tampon, rang + 2, texte, decalage)
    return tampon


def final(tampon, resume, etat_ups, decalage=0):
    tampon.effacer()
    bloquants = [l for l, marque, tolerant in resume if not tolerant and marque != "OK"]
    if bloquants:
        _ligne(tampon, 0, "STATUT : A SURVEILLER", decalage)
        _ligne(tampon, 2, "en echec :", decalage)
        for rang, libelle in enumerate(bloquants[:5]):
            _ligne(tampon, 3 + rang, "- %s" % libelle[:19], decalage)
        return tampon

    _ligne(tampon, 1, "   STATUT : OK   ", decalage)
    _ligne(tampon, 3, "ap      %s" % _ip("uap0"), decalage)
    _ligne(tampon, 4, "lien    %s" % _ip("eth0"), decalage)
    if etat_ups:
        _ligne(
            tampon,
            6,
            "bat     %.0f%% %s" % (etat_ups["pourcent"], "CH" if etat_ups["en_charge"] else "DC"),
            decalage,
        )
    else:
        _ligne(tampon, 6, "bat     absente", decalage)
    return tampon


def page_systeme(tampon, etat_ups, decalage=0):
    tampon.effacer()
    _, (sains, total) = etapes.conteneurs()
    uptime = _uptime()
    _ligne(tampon, 0, "SYSTEME", decalage)
    _ligne(tampon, 2, "up      %s" % uptime[:12], decalage)
    _ligne(tampon, 3, "ctn     %d/%d" % (sains, total), decalage)
    charge = open("/proc/loadavg").read().split() if _lisible("/proc/loadavg") else ["-"]
    _ligne(tampon, 4, "charge  %s" % charge[0], decalage)
    _ligne(
        tampon,
        5,
        "net     %s" % ("connecte OK" if _internet() else "hors ligne"),
        decalage,
    )
    if etat_ups:
        _ligne(tampon, 6, "batterie %.0f%%" % etat_ups["pourcent"], decalage)
    return tampon


def page_reseau(tampon, etat_ups, decalage=0):
    tampon.effacer()
    _ligne(tampon, 0, "RESEAU", decalage)
    _ligne(tampon, 2, "ap      %s" % _ip("uap0"), decalage)
    _ligne(tampon, 3, "lien    %s" % _ip("eth0"), decalage)
    wifi = "|".join(
        l.split(":")[1]
        for l in _commande(["nmcli", "-t", "-f", "DEVICE,STATE", "device", "status"])
        if l.startswith("wlan0:")
    )
    _ligne(tampon, 4, "wifi    %s" % (wifi[:11] or "-"), decalage)
    chrony = "".join(_commande(["chronyc", "-c", "tracking"]))
    if chrony:
        champs = chrony.split(",")
        stratum = champs[2] if len(champs) > 2 else "-"
    else:
        stratum = "-"
    _ligne(tampon, 5, "heure   stratum %s" % stratum[:6], decalage)
    return tampon


def page_mesures(tampon, etat_ups, decalage=0):
    tampon.effacer()
    _ligne(tampon, 0, "MESURES", decalage)
    try:
        with __import__("urllib.request", fromlist=["urlopen"]).urlopen(
            "http://127.0.0.1:3000/api/v1/alerts?limit=1", timeout=2
        ) as reponse:
            import json

            donnees = json.load(reponse)
            alerte = (donnees.get("data") or [None])[0]
    except Exception:
        alerte = None
    if alerte:
        _ligne(tampon, 2, "carte   %s" % str(alerte.get("device_id"))[:13], decalage)
        mesures = alerte.get("measurements") or {}
        for rang, (nom, valeur) in enumerate(list(mesures.items())[:4]):
            _ligne(
                tampon,
                3 + rang,
                "%-8.8s %s" % (nom[:8], ("%.1f" % valeur)[:10]),
                decalage,
            )
    else:
        _ligne(tampon, 3, "aucune mesure", decalage)
    return tampon


def page_batterie(tampon, etat_ups, decalage=0):
    tampon.effacer()
    _ligne(tampon, 0, "BATTERIE", decalage)
    if not etat_ups:
        _ligne(tampon, 3, "carte absente", decalage)
        _ligne(tampon, 5, "(a verifier)", decalage)
        return tampon
    _ligne(tampon, 2, "charge  %.0f %%" % etat_ups["pourcent"], decalage)
    _ligne(tampon, 3, "tension %.2f V" % etat_ups["tension"], decalage)
    courant = etat_ups["courant_ma"]
    if courant is None:
        _ligne(tampon, 4, "courant -", decalage)
    else:
        _ligne(tampon, 4, "courant %+.0f mA" % courant, decalage)
    _ligne(
        tampon,
        6,
        "etat    %s" % ("en charge" if etat_ups["en_charge"] else "sur batterie"),
        decalage,
    )
    return tampon


PAGES = (page_systeme, page_batterie)


def _uptime():
    with open("/proc/uptime") as f:
        secondes = float(f.read().split()[0])
    duree = datetime.timedelta(seconds=int(secondes))
    return str(duree)


def _lisible(chemin):
    try:
        open(chemin).close()
        return True
    except OSError:
        return False


def _commande(arguments):
    import subprocess

    try:
        resultat = subprocess.run(
            arguments, capture_output=True, text=True, timeout=3
        )
    except OSError:
        return []
    if resultat.returncode != 0:
        return []
    return [l for l in resultat.stdout.strip().splitlines() if l]


_CACHE_INTERNET = {"instant": None, "ok": False}
MEMOIRE_INTERNET = 20.0


def _internet(cible="8.8.8.8", delai=2):
    """Sortie Internet : un ping, et on s en souvient un moment.

    Sans cette memoire, un reseau absent ferait attendre le delai d expiration
    a chaque tour de la boucle : l affichage se figerait deux secondes tous
    les sept.
    """
    import subprocess

    maintenant = time.monotonic()
    if (
        _CACHE_INTERNET["instant"] is not None
        and maintenant - _CACHE_INTERNET["instant"] < MEMOIRE_INTERNET
    ):
        return _CACHE_INTERNET["ok"]
    try:
        resultat = subprocess.run(
            ["ping", "-c", "1", "-W", str(delai), cible],
            capture_output=True,
            timeout=delai + 2,
        )
        ok = resultat.returncode == 0
    except (OSError, subprocess.SubprocessError):
        ok = False
    _CACHE_INTERNET["instant"] = maintenant
    _CACHE_INTERNET["ok"] = ok
    return ok
