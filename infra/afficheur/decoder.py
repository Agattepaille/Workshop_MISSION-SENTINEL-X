# Decodage d une trame affichee : la police etant connue, chaque cellule de
# 6x8 se reconnait. C est le seul moyen de verifier a distance, et sans prise
# de vue, ce que l ecran montre reellement.

import police


def _index():
    """Table inverse : signature des 5 colonnes vers le caractere."""
    if getattr(_index, "table", None):
        return _index.table
    _index.table = {tuple(v): chr(k) for k, v in police.CARACTERES.items()}
    return _index.table


def decoder_cellule(valeurs):
    """valeurs : 5 entiers, un par colonne (bit 0 = haut). None si vide."""
    table = _index()
    if all(v == 0 for v in valeurs):
        return " "
    return table.get(tuple(valeurs), "?")


def decoder_trame(octets, largeur=128, pages=8, caracteres=21):
    """Renvoie la liste des lignes de texte lues dans le tampon."""
    lignes = []
    for page in range(pages):
        ligne = []
        for rang in range(caracteres):
            base = page * largeur + rang * police.LARGEUR
            valeurs = [octets[base + c] for c in range(5)]
            ligne.append(decoder_cellule(valeurs))
        lignes.append("".join(ligne).rstrip())
    return lignes


def presenter(octets, **arguments):
    return "\n".join(
        "%d |%s|" % (i, l)
        for i, l in enumerate(decoder_trame(octets, **arguments))
    )
