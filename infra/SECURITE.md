# Matrice de durcissement — pilier CYBER

Chaque ligne = une surface d'attaque, la mesure appliquee, et l'etat verifie
sur la machine (pas une intention : un constat).

## 1. Matrice

| Surface | Menace | Mesure | Etat |
|---|---|---|---|
| SSH | Brute force / acces distance | Cle ed25519, `PasswordAuthentication no`, port `2222` | Verifie (`sshd -T`) |
| SSH root | Escalade directe | `PermitRootLogin no`, `AllowUsers sentinel-x12` | Verifie |
| Firewall | Services exposes | UFW `deny incoming`, `allow outgoing`, `allow routed` | Actif |
| SSH depuis Internet | Scan de port | Regle limitee a `192.168.100.0/24` (le PC d'admin) | Actif |
| ESP → broker | Ecoute / injection | MQTTS (TLS) + authentification obligatoire | Verifie (anonyme refuse) |
| Broker anonyme | Publication libre | `allow_anonymous false` + mots de passe | Verifie (exit 5) |
| Droits MQTT | Un ESP lit les donnees des autres | ACL par utilisateur (`esp`/`api`/`ia`) | En place |
| Rebond ESP | Exfiltration | Pas de NAT sur le WiFi : aucun acces Internet | Verifie |
| Secrets | Fuite dans Git | `.gitignore` + `.env` chmod 600 hors depot | Verifie |
| Base / dashboard | Exposition publique | `influxdb` et `grafana` ecoutent en `127.0.0.1` | Verifie |
| Acces distant | Exposition directe | Tunnel Cloudflare sortant + mur Access (email) | Actif |
| Conteneurs | Escalade de privileges | `no-new-privileges`, `cap_drop ALL` quand possible | Applique |

## 2. Plan d'adressage

| Element | Valeur | Pourquoi ce choix |
|---|---|---|
| Admin / PC | `192.168.100.0/24` | Lien direct RPi ↔ PC |
| SSH | port `2222` | Reduit le bruit des scans automatises |
| AP WiFi | `/29` → 6 hotes | 3 ESP max : le plus juste, pas de gaspillage |
| Plage | hors `192.168.x.x` et `10.0.0.x` | Evite les collisions avec les box etudiants |
| DHCP AP | 3 adresses seulement | Au-dela, l'adresse est refusee : un intrus ne rentre pas |

Le `/29` est la taille minimale couvrant 3 ESP + la passerelle : plus on
restreint la plage, plus l'enumeration d'un intrus est dure.

## 3. Authentification MQTT

Trois utilisateurs, un par role, avec des ACL disjointes :

| User | Ecriture | Lecture |
|---|---|---|
| `esp` | `sentinel/table/sensors/#` | `sentinel/table/actuators/#` |
| `api` | `sentinel/table/actuators/#` | `sentinel/table/sensors/#`, `$SYS/#` |
| `ia`  | `sentinel/table/actuators/#` | `sentinel/table/sensors/#`, `$SYS/#` |

Un ESP ne peut **pas** s'abonner aux capteurs des autres : il n'a le droit
qu'a l'ecriture sur sa branche. C'est le principe du moindre privilege.

## 4. PKI et TLS

Une **CA privee** propre au projet signe un certificat serveur.

- Ces deux choix sont volontaires : SAN `IP:10.73.42.1,DNS:localhost`, TLS >= 1.2.
- `ca.key` reste sur le RPi (chmod 600) et **ne doit jamais** etre copie ailleurs.
- Seul le certificat **public** (`ca.crt`) est transmis a l'equipe DEV, hors Git,
  pour etre embarque dans le firmware des ESP.

Pourquoi une CA privee plutot qu'un certificat auto-signe : l'ESP peut
verifier la chaine de confiance, ce qui bloque toute attaque de type
« l'homme du milieu ». Avec un simple certificat auto-signe, un attaquant
pourrait presenter le sien sans que la carte ne bronche.

## 5. Limites connues

Documentees honnetement — pile FIABLE/SECURISE ne veut pas dire infaillible :

1. **Allowlist MAC non activee** : `macaddr_acl=0` tant que les adresses MAC
   des ESP ne sont pas connues. Le fichier est pret.
2. **PSK partage** : les ESP se connectent au WiFi avec la meme cle. Un
   isolement des clients entre eux n'est pas active.
3. **Temps de session Cloudflare** : regler une duree courte dans le dashboard
   Zero Trust pour limiter la fenetre d'un poste laisse ouvert.
