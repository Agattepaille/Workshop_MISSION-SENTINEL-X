# Lecture de la carte d alimentation Waveshare UPS HAT (B)
#
# La carte mesure son pack 2S (deux 18650 en serie : 7,4 V nominal, 8,4 V pleine
# charge) avec un INA219 en I2C a l adresse 0x42. Ce n est pas une jauge : aucun
# registre ne donne le pourcentage. Il faut donc le deduire de la tension, ce
# que fait aussi le code officiel Waveshare avec une regle lineaire grossiere.
#
# On prefere ici la courbe de decharge d un Li-ion 2S, plus fidele : le code
# Waveshare annonce 100 % des 8,4 V mais surestime le milieu de decharge.
#
# Le courant, lui, vient de la tension de shunt : negatif quand les batteries
# alimentent la borne, positif quand elles se rechargent (convention Waveshare).

VALEURS = {}
CONFIG_DEFAUT = {
    "adresse": 0x42,
    "bus": 1,
    "resistance_shunt": 0.1,   # ohms : valeur des modules Waveshare
}

# Courbe de decharge d un Li-ion, par cellule, lue dans le sens habituel des
# fiches techniques. Le pack valant deux cellules, on double.
COURBE = (
    (4.20, 100.0),
    (4.10,  96.0),
    (4.00,  88.0),
    (3.90,  76.0),
    (3.80,  63.0),
    (3.70,  50.0),
    (3.60,  36.0),
    (3.50,  24.0),
    (3.40,  15.0),
    (3.30,   8.0),
    (3.20,   3.0),
    (3.00,   0.0),
)


def pourcentage(tension_pack):
    """Traduit la tension du pack en pourcentage par interpolation."""
    tension_cellule = tension_pack / 2.0
    if tension_cellule >= COURBE[0][0]:
        return 100.0
    if tension_cellule <= COURBE[-1][0]:
        return 0.0
    for (haute, pc_haut), (basse, pc_bas) in zip(COURBE, COURBE[1:]):
        if basse <= tension_cellule <= haute:
            part = (tension_cellule - basse) / (haute - basse)
            return pc_bas + part * (pc_haut - pc_bas)
    return 0.0


def complement_deux(valeur):
    return valeur - 0x10000 if valeur & 0x8000 else valeur


class Ups:
    """Lecteur INA219 : renvoie None quand la carte n est pas joignable."""

    def __init__(self, bus=1, adresse=0x42, resistance_shunt=0.1):
        self.bus_numero = bus
        self.adresse = adresse
        self.resistance = resistance_shunt
        self.trait = None

    def _bus(self):
        if self.trait is None:
            try:
                from smbus2 import SMBus
                self.trait = SMBus(self.bus_numero)
            except Exception:
                self.trait = False
        return self.trait or None

    def _registre(self, numero):
        bus = self._bus()
        if bus is None:
            return None
        try:
            # read_i2c_block_data livre les octets dans l ordre du bus :
            # l INA219 envoie le poids fort d abord, aucun echange a faire.
            brut = bus.read_i2c_block_data(self.adresse, numero, 2)
        except OSError:
            return None
        return (brut[0] << 8) | brut[1]

    def tension_bus(self):
        brut = self._registre(0x02)
        if brut is None:
            return None
        return (brut >> 3) * 0.004

    def tension_shunt(self):
        brut = self._registre(0x01)
        if brut is None:
            return None
        return complement_deux(brut) * 0.00001

    def courant(self):
        """Courant en mA, positif en charge, negatif en decharge."""
        vshunt = self.tension_shunt()
        if vshunt is None:
            return None
        return (vshunt / self.resistance) * 1000.0

    def etat(self):
        """Regroupe tout l utile ; None partout si la carte est absente."""
        tension = self.tension_bus()
        courant = self.courant()
        if tension is None:
            return None
        return {
            "tension": round(tension, 2),
            "courant_ma": None if courant is None else round(courant, 1),
            "pourcent": round(pourcentage(tension), 1),
            "en_charge": bool(courant is not None and courant > 30),
        }
