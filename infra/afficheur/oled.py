# Tampon image et pilotage d un SSD1306 en 128x64 (et SH1106, meme famille)
#
# Pourquoi un pilote maison plutot que luma.oled ou Adafruit ?
#  - la borne n a pas pip (et l installer avec --break-system-packages salit le
#    systeme) ;
#  - luma.oled et Blinka ont eu une periode d incompatibilite avec le Pi 5 ;
#  - il nous faut 60 lignes de code et aucune dependance : smbus2 est deja la.
#
# Le module sait aussi fonctionner SANS materiel : en mode "sec" il fabrique la
# trame mais n ecrit rien. C est ce qui permet de verifier la mise en page a
# distance, avant meme que l ecran soit branche.

import police


class OLED:
    """Pilote minimal I2C pour un SSD1306 128x64 (variante SH1106 supportee)."""

    LARGEUR = 128
    HAUTEUR = 64
    PAGES = HAUTEUR // 8

    # --- Initialisation d un SSD1306 128x64 : ordre identique a la doc ------
    INIT = (
        b"\xae",             # ecran eteint pendant le reglage
        b"\xd5\x80",         # horloge interne
        b"\xa8\x3f",         # multiplexeur : 64 lignes
        b"\xd3\x00",         # decalage vertical nul
        b"\x40",             # depart d affichage ligne 0
        b"\x8d\x14",         # pompe de charge interne (le contraste en a besoin)
        b"\x20\x00",         # adressage horizontal
        b"\xa1",             # balayage des segments inverse
        b"\xc8",             # balayage des lignes inverse
        b"\xda\x12",         # brochage des lignes COM
        b"\x81\xcf",         # contraste
        b"\xd9\xf1",         # precharge
        b"\xdb\x40",         # niveau VCOM
        b"\xa4",             # reprendre l affichage du contenu memoire
        b"\xa6",             # pixels non inverses
        b"\xaf",             # ecran allume
    )

    def __init__(self, bus=1, adresse=None, variante="ssd1306", sec=False):
        # 0x3C est l adresse par defaut ; certains modules sont soudes en 0x3D.
        self.adresses = [adresse] if adresse else [0x3C, 0x3D]
        self.variante = variante
        self.bus_numero = bus
        self.sec = sec
        self.trait = None
        self.adresse = None

    # --- Connexion ---------------------------------------------------------
    def ouvrir(self):
        """Ouvre le bus et repond l adresse trouvee, ou None sans materiel."""
        if self.sec:
            return None
        try:
            from smbus2 import SMBus
        except ImportError:
            return None

        try:
            self.bus = SMBus(self.bus_numero)
        except OSError:
            return None

        for adresse in self.adresses:
            if self._present(adresse):
                self.adresse = adresse
                self.trait = self.bus.open(adresse) if False else None
                self._initialiser()
                return adresse
        return None

    def _present(self, adresse):
        """Un simple octet lu suffit : present si le module acquitte."""
        try:
            from smbus2 import i2c_msg
            self.bus.i2c_rdwr(i2c_msg.write(adresse, [0x00]))
            return True
        except OSError:
            return False

    def _ecrire_bloc(self, controle, donnees):
        # smbus2 limite un bloc a 32 octets : on decoupe.
        for depart in range(0, len(donnees), 32):
            morceau = list(donnees[depart : depart + 32])
            self.bus.write_i2c_block_data(self.adresse, controle, morceau)

    def _commande(self, octets):
        self._ecrire_bloc(0x00, bytes(octets))

    def _initialiser(self):
        for groupe in self.INIT:
            self._commande(groupe)

    # --- Affichage ---------------------------------------------------------
    def afficher(self, tampon):
        """Envoie les 8 pages du tampon (8 x 128 octets)."""
        if self.sec or self.adresse is None:
            return False
        decalage_colonne = 2 if self.variante == "sh1106" else 0
        for page in range(self.PAGES):
            self._commande(
                bytes(
                    (
                        0xB0 | page,
                        0x00 | (decalage_colonne & 0x0F),
                        0x10 | (decalage_colonne >> 4),
                    )
                )
            )
            debut = page * self.LARGEUR
            self._ecrire_bloc(0x40, tampon.octets[debut : debut + self.LARGEUR])
        return True

    def contraste(self, valeur):
        if self.adresse is not None:
            self._commande(b"\x81" + bytes((valeur,)))

    def eteindre(self):
        if self.adresse is not None:
            self._commande(b"\xae")


class Tampon:
    """Image 128x64 en memoire, en adressage par page (bit 0 = haut de page)."""

    def __init__(self, largeur=OLED.LARGEUR, hauteur=OLED.HAUTEUR):
        self.largeur = largeur
        self.hauteur = hauteur
        self.pages = hauteur // 8
        self.octets = bytearray(largeur * self.pages)

    def effacer(self):
        self.octets = bytearray(len(self.octets))

    def pixel(self, x, y, allume=True):
        if not (0 <= x < self.largeur and 0 <= y < self.hauteur):
            return
        rang = (y // 8) * self.largeur + x
        if allume:
            self.octets[rang] |= 1 << (y % 8)
        else:
            self.octets[rang] &= ~(1 << (y % 8))

    def texte(self, x, y, chaine):
        """Ecrit une chaine au pixel (x, y) avec la police 5x7."""
        for rang, caractere in enumerate(chaine):
            colonne = x + rang * police.LARGEUR
            if colonne + 5 > self.largeur:
                break
            for decalage, bits in enumerate(police.colonnes(caractere)):
                for ligne in range(police.HAUTEUR):
                    if bits & (1 << ligne):
                        self.pixel(colonne + decalage, y + ligne)

    def trait_horizontal(self, x, y, longueur, plein=True):
        for i in range(longueur):
            self.pixel(x + i, y, plein)

    def rectangle(self, x, y, largeur, hauteur, plein=False):
        for colonne in range(largeur):
            bord = colonne == 0 or colonne == largeur - 1
            for ligne in range(hauteur):
                haut_bas = ligne == 0 or ligne == hauteur - 1
                if plein or bord or haut_bas:
                    self.pixel(x + colonne, y + ligne, True)

    def vers_pbm(self, chemin):
        """Ecrit une image PBM P4 : lisible, convertible, et comparable."""
        entete = "P4\n%d %d\n" % (self.largeur, self.hauteur)
        with open(chemin, "wb") as fichier:
            fichier.write(entete.encode("ascii"))
            fichier.write(bytes(self.octets))

    def vers_texte(self, largeur_utile=None):
        """Rendu ASCII du tampon : seule maniere de le verifier a distance."""
        largeur_utile = largeur_utile or self.largeur
        sortie = []
        for y in range(self.hauteur):
            rang_page = (y // 8) * self.largeur
            ligne = "".join(
                "#" if (self.octets[rang_page + x] >> (y % 8)) & 1 else "."
                for x in range(largeur_utile)
            )
            sortie.append(ligne)
        return "\n".join(sortie)
