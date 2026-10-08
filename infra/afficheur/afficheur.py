#!/usr/bin/env python3
"""Afficheur de la borne : suit le demarrage jusqu au STATUT OK, puis fait
defiler un resume vivant.

Trois principes tenus depuis le debut :
  - ne jamais bloquer ou retarder le demarrage (aucune dependance exigeante) ;
  - ne rien afficher qui ressemble a un secret (ni mot de passe, ni SSID) ;
  - rester verifiable a distance : option --sec pour fabriquer la trame sans
    materiel, et un etat ecrit en memoire (/run) plutot que sur la carte SD.

Usage :
  python3 afficheur.py                    # service normal
  python3 afficheur.py --sec --rendu      # apercu en texte, sans ecran
  python3 afficheur.py --instantane /tmp/ecran.pbm --mode final --sec
"""

import argparse
import json
import os
import sys
import time

import decoder
import etapes
import oled
import rendu
import ups

ETAT = "/run/sentinel-afficheur/etat.json"
CYCLE_BOOT = 1.2
CYCLE_PAGES = 7.0
DUREE_FINAL = 10.0
DELAI_RECHERCHE = 15.0   # reessaie de trouver l ecran toutes les 15 s


def charger_etat_precedent():
    try:
        with open(ETAT) as fichier:
            return json.load(fichier)
    except (OSError, ValueError):
        return {}


def ecrire_etat(contenu):
    os.makedirs(os.path.dirname(ETAT), exist_ok=True)
    temporaire = ETAT + ".tmp"
    with open(temporaire, "w") as fichier:
        json.dump(contenu, fichier)
    os.replace(temporaire, ETAT)


def journal(message, **champs):
    ligne = {"ts": time.strftime("%H:%M:%S"), "msg": message, **champs}
    print(json.dumps(ligne, ensure_ascii=False), flush=True)


def principales(options):
    ecran = oled.OLED(
        bus=options.bus,
        adresse=options.adresse,
        variante=options.variante,
        sec=options.sec,
    )
    adresse = ecran.ouvrir()
    if adresse is None and not options.sec:
        journal("aucun ecran detecte sur le bus I2C", bus=options.bus)
    elif adresse is not None:
        journal("ecran detecte", adresse=hex(adresse))

    batterie = ups.Ups(bus=options.bus)
    tampon = oled.Tampon()

    if options.instantane:
        composer_instantane(tampon, options, batterie)
        tampon.vers_pbm(options.instantane)
        if options.rendu:
            print(decoder.presenter(bytes(tampon.octets)))
        return 0

    suivi = etapes.Suivi()
    precedent = {}
    phase = "boot"
    entree_final = None
    rang_page = 0
    decalage = 0
    derniere_tentative = time.monotonic()

    while True:
        debut = time.monotonic()

        # Reconnexion a chaud : si l ecran arrive apres coup (cable rebranche,
        # bus encore occupe au demarrage), on reessaie tranquillement plutot
        # que d attendre un reboot.
        if ecran.adresse is None and not options.sec:
            if debut - derniere_tentative > DELAI_RECHERCHE:
                derniere_tentative = debut
                trouve = ecran.ouvrir()
                if trouve is not None:
                    journal("ecran branche et reconnu", adresse=hex(trouve))

        etat_batterie = batterie.etat()
        suivi.evaluer()
        resume = suivi.resume()
        progression = suivi.progression()

        for (libelle, marque, _) in resume:
            if precedent.get(libelle) != marque:
                journal("etape", nom=libelle, etat=marque)
        precedent = {libelle: marque for libelle, marque, _ in resume}

        ecrire_etat(
            {
                "maj": time.time(),
                "phase": phase,
                "etapes": {libelle: marque for libelle, marque, _ in resume},
                "progression": progression,
                "batterie": etat_batterie,
            }
        )

        if phase == "boot":
            if suivi.termine():
                phase = "final"
                entree_final = time.monotonic()
                journal("demarrage termine, toutes les etapes bloquantes sont OK")
            else:
                rendu.boot(
                    tampon, resume, progression, time.monotonic() - suivi.depart, decalage
                )
                if time.monotonic() - suivi.depart > suivi.delai_echec + 30:
                    phase = "pages"
                    journal("on passe aux pages, certaines etapes restent en echec")
        elif phase == "final":
            rendu.final(tampon, resume, etat_batterie, decalage)
            if time.monotonic() - entree_final > DUREE_FINAL:
                phase = "pages"
        else:
            rendu.PAGES[rang_page](tampon, etat_batterie, decalage)

        ecran.afficher(tampon)
        if options.rendu:
            print(decoder.presenter(bytes(tampon.octets)), flush=True)

        if phase == "pages":
            rang_page = (rang_page + 1) % len(rendu.PAGES)
            decalage = 1 - decalage     # anti-marquage : tout bouge d un pixel

        attente = (CYCLE_BOOT if phase == "boot" else CYCLE_PAGES) - (
            time.monotonic() - debut
        )
        time.sleep(max(attente, 0.2))


def composer_instantane(tampon, options, batterie):
    """Fabrique une seule image, pour verifier la mise en page sans ecran."""
    suivi = etapes.Suivi()
    suivi.evaluer()
    etat_batterie = batterie.etat()
    mode = options.mode
    if mode == "boot":
        rendu.boot(tampon, suivi.resume(), suivi.progression(), 12)
    elif mode.startswith("page"):
        index = int(mode.split(":")[1]) if ":" in mode else 0
        rendu.PAGES[index % len(rendu.PAGES)](tampon, etat_batterie)
    elif mode == "absente":
        rendu.page_batterie(tampon, None)
    else:
        rendu.final(tampon, suivi.resume(), etat_batterie)


def lire_arguments():
    parseur = argparse.ArgumentParser(description="Afficheur OLED de la borne")
    parseur.add_argument("--bus", type=int, default=1)
    parseur.add_argument("--adresse", type=lambda v: int(v, 16), default=None)
    parseur.add_argument("--variante", default="ssd1306", choices=("ssd1306", "sh1106"))
    parseur.add_argument("--sec", action="store_true", help="sans materiel : trame seule")
    parseur.add_argument("--rendu", action="store_true", help="sortie ASCII de la trame")
    parseur.add_argument("--instantane", help="ecrit une image PBM et quitte")
    parseur.add_argument(
        "--mode",
        default="final",
        help="boot | final | page:0..3 pour l instantane",
    )
    return parseur.parse_args()


if __name__ == "__main__":
    sys.exit(principales(lire_arguments()))
