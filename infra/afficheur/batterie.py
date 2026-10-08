#!/usr/bin/env python3
"""Surveillance de la carte d alimentation et arret propre en cas de faiblesse.

Lit l etat publie par l afficheur dans /run (memoire, rien n est ecrit sur la
carte SD) et applique trois seuils :

  - sous alerte      : journal + Sonde HTTP qui passe en 503 (Beszel alerte) ;
  - sous critique    : idem, et compte a rebours d arret si c est durable ;
  - arret effectif   : seulement si la batterie ne se recharge PAS et que la
                       borne tourne depuis assez longtemps, sinon on risque
                       d arreter une machine qui vient juste de demarrer.

Rien n agit sans confirmation dans le temps : une chute de tension momentanee
(appel de courant d un disque, par exemple) ne declenche jamais d arret.
"""

import argparse
import http.server
import json
import os
import subprocess
import sys
import threading
import time

ETAT = "/run/sentinel-afficheur/etat.json"
CONFIG = "/etc/sentinel/afficheur.conf"
DEFAUTS = {
    "seuil_alerte": 25.0,
    "seuil_critique": 10.0,
    "delai_critique": 120.0,     # secondes sous le seuil avant arret
    "delai_grace": 300.0,        # duree minimale depuis le boot
    "arret_auto": True,
    "sonde_port": 8099,
    "sonde_active": True,
}


def charger_configuration():
    valeurs = dict(DEFAUTS)
    try:
        with open(CONFIG) as fichier:
            for ligne in fichier:
                ligne = ligne.split("#", 1)[0].strip()
                if not ligne or "=" not in ligne:
                    continue
                cle, brut = (partie.strip() for partie in ligne.split("=", 1))
                if cle in valeurs:
                    if isinstance(valeurs[cle], bool):
                        valeurs[cle] = brut.lower() in ("1", "oui", "true", "yes")
                    else:
                        try:
                            valeurs[cle] = type(valeurs[cle])(brut)
                        except ValueError:
                            pass
    except OSError:
        pass
    return valeurs


def journal(message, **champs):
    print(
        json.dumps({"ts": time.strftime("%H:%M:%S"), "msg": message, **champs},
                   ensure_ascii=False),
        flush=True,
    )


class EtatPartage:
    """Dernier etat connu, partage avec le serveur de sonde."""

    def __init__(self):
        self.contenu = {"batterie": None, "maj": None, "visible": False}

    def actualiser(self, donnees, visible):
        self.contenu = {
            "batterie": donnees.get("batterie"),
            "maj": donnees.get("maj"),
            "visible": visible,
        }


class Sonde(http.server.BaseHTTPRequestHandler):
    etat = EtatPartage()
    seuil_alerte = DEFAUTS["seuil_alerte"]

    def do_GET(self):
        batterie = self.etat.contenu.get("batterie")
        if not batterie:
            corps, code = {"erreur": "batterie absente ou non lue"}, 501
        elif batterie["pourcent"] < self.seuil_alerte:
            corps, code = {
                "charge": batterie["pourcent"],
                "tension": batterie["tension"],
                "etat": "sous le seuil d alerte",
            }, 503
        else:
            corps, code = {
                "charge": batterie["pourcent"],
                "tension": batterie["tension"],
                "en_charge": batterie["en_charge"],
            }, 200
        brut = json.dumps(corps).encode("utf8")
        self.send_response(code)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("content-length", str(len(brut)))
        self.end_headers()
        self.wfile.write(brut)

    def log_message(self, *arguments):
        pass


def demarrer_sonde(port, etat, seuil):
    Sonde.etat = etat
    Sonde.seuil_alerte = seuil
    try:
        serveur = http.server.ThreadingHTTPServer(("127.0.0.1", port), Sonde)
    except OSError as cause:
        journal("sonde non demarree", raison=str(cause))
        return None
    thread = threading.Thread(target=serveur.serve_forever, daemon=True)
    thread.start()
    return serveur


def boucle(options):
    configuration = charger_configuration()
    journal(
        "surveillance de la batterie",
        seuil_alerte=configuration["seuil_alerte"],
        seuil_critique=configuration["seuil_critique"],
        arret_auto=configuration["arret_auto"],
    )
    etat = EtatPartage()
    if configuration["sonde_active"]:
        serveur = demarrer_sonde(configuration["sonde_port"], etat, configuration["seuil_alerte"])
        if serveur:
            journal("sonde locale", ecoute="127.0.0.1:%d" % configuration["sonde_port"])

    age_limite = 30.0
    sous_seuil_depuis = None
    deja_alerte = False

    while True:
        donnees = {}
        try:
            with open(ETAT) as fichier:
                donnees = json.load(fichier)
        except (OSError, ValueError):
            donnees = {}

        fraiche = donnees.get("maj") is not None and (
            time.time() - donnees["maj"] < age_limite
        )
        etat.actualiser(donnees, fraiche)
        batterie = donnees.get("batterie")

        if batterie is None:
            sous_seuil_depuis = None
            if not options.sec:
                time.sleep(options.cycle)
                continue

        pourcent = batterie["pourcent"]
        en_charge = batterie.get("en_charge")

        if pourcent < configuration["seuil_alerte"] and not en_charge and not deja_alerte:
            deja_alerte = True
            journal("batterie faible", charge=pourcent, seuil=configuration["seuil_alerte"])
        elif pourcent >= configuration["seuil_alerte"] + 5:
            deja_alerte = False

        critique = pourcent < configuration["seuil_critique"] and not en_charge
        if critique:
            if sous_seuil_depuis is None:
                sous_seuil_depuis = time.monotonic()
                journal("batterie critique, debut du compte a rebours", charge=pourcent)
            duree = time.monotonic() - sous_seuil_depuis
            delai = max(0.0, configuration["delai_critique"] - duree)
            journal("avant arret", secondes=int(delai), charge=pourcent)
            if duree >= configuration["delai_critique"]:
                if _uptime() < configuration["delai_grace"]:
                    journal("arret refuse : borne demarree trop recemment")
                elif not configuration["arret_auto"]:
                    journal("arret refuse : arret_auto desactive dans la configuration")
                else:
                    journal("ARRET PROPRE, batterie critique", charge=pourcent)
                    with open("/run/sentinel-afficheur/dernier-mot.txt", "w") as f:
                        f.write("arret sur batterie critique %.1f %%\n" % pourcent)
                    subprocess.run(["systemctl", "poweroff"], check=False)
                    return 0
        else:
            sous_seuil_depuis = None

        time.sleep(options.cycle)


def _uptime():
    with open("/proc/uptime") as fichier:
        return float(fichier.read().split()[0])


if __name__ == "__main__":
    parseur = argparse.ArgumentParser(description="Protection batterie de la borne")
    parseur.add_argument("--cycle", type=float, default=5.0)
    parseur.add_argument("--sec", action="store_true", help="n arrete jamais la machine")
    sys.exit(boucle(parseur.parse_args()))
