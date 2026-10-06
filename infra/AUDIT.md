# Rapport d'audit — Mission Sentinel-X

Date : 6 octobre 2026
Perimetre : Raspberry Pi 5 (PC Serveur Local), stack Docker, AP WiFi, Mosquitto.
Methode : tests reels executes sur la machine. Resultats constates, non prevus.

Legende : **[OK]** conforme · **[ECHEC]** a corriger · **[N/A]** non applicable

## 1. Acces et administration

| # | Test | Commande | Resultat | Etat |
|---|---|---|---|---|
| 1 | SSH par cle | `ssh -p 2222` | Connexion etablie | **[OK]** |
| 2 | Mot de passe SSH refuse | `sshd -T` | `passwordauthentication no` | **[OK]** |
| 3 | Root interdit | `sshd -T` | `permitrootlogin no` | **[OK]** |
| 4 | Port modifie | `ss -lnt` | `0.0.0.0:2222` | **[OK]** |

## 2. Pare-feu

| # | Test | Resultat | Etat |
|---|---|---|---|
| 5 | UFW actif | `deny incoming` / `allow outgoing` / `allow routed` | **[OK]** |
| 6 | Regles AP | DHCP `67/68`, DNS `53`, MQTTS `8883` sur `wlan0` | **[OK]** |
| 7 | SSH restreint | Uniquement depuis `192.168.100.0/24` | **[OK]** |
| 8 | Politique forwarding | `DEFAULT_FORWARD_POLICY=ACCEPT` (reseau Docker preserve) | **[OK]** |

## 3. Broker MQTT

| # | Test | Resultat | Etat |
|---|---|---|---|
| 9 | Connexion anonyme refuse | `Connection Refused: not authorised` | **[OK]** |
| 10 | Publication avec identifiants | exit `0` | **[OK]** |
| 11 | Chiffrement TLS | `Verify return code: 0 (ok)` | **[OK]** |
| 12 | Certificat | SAN `IP:10.73.42.1`, `DNS:localhost` | **[OK]** |
| 13 | ACL chargees | Regles `esp`/`api`/`ia` actives | **[OK]** |
| 14 | Port 1883 non expose | Ecoute sur le reseau Docker interne uniquement | **[OK]** |

> Le test 9 est le plus important : c'est la preuve qu'un equipement non
> autorise ne peut pas publier sur le bus, meme en connaissant l'IP.

## 4. Donnees et supervision

| # | Test | Resultat | Etat |
|---|---|---|---|
| 15 | InfluxDB operationnel | `ready for queries and writes` | **[OK]** |
| 16 | Ecriture InfluxDB | HTTP `204` | **[OK]** |
| 17 | Collecte Telegraf | Mesures `cpu`, `mem`, `disk`, `docker_*`, `mqtt_consumer` | **[OK]** |
| 18 | Supervision broker | Topics `$SYS/broker/*` presents | **[OK]** |
| 19 | Dashboard Grafana | 10 panneaux provisionnes | **[OK]** |
| 20 |Ports sensibles non exposes | `8086` et `3000` en `127.0.0.1` | **[OK]** |

## 5. Acces distant

| # | Test | Resultat | Etat |
|---|---|---|---|
| 21 | Tunnel Cloudflare | `cloudflared` actif | **[OK]** |
| 22 | Mur Access actif | `302` vers la page d'authentification | **[OK]** |
| 23 | HTTPS | Certificat Cloudflare, aucune terminaison locale a securiser | **[OK]** |

## 6. Compte lecture seule

| # | Test | Resultat | Etat |
|---|---|---|---|
| 24 | Viewer lit le dashboard | HTTP `200` | **[OK]** |
| 25 | Viewer ne peut pas ecrire | HTTP `403` sur creation de datasource | **[OK]** |

## 7. Points de vigilance

| # | Constat | Risque | Action |
|---|---|---|---|
| A | Allowlist MAC non activee | Un poste non autorise peut rejoindre l'AP si le PSK est connu | Activer `macaddr_acl=1` des que les 3 MAC sont connues |
| B | WPA2 (pas WPA3) | Compatibilite ESP8266 | Contraint par le materiel |
| C | Session Cloudflare longue | Poste laisse ouvert | Reduire la duree de session dans Zero Trust |

## Conclusion

**25 tests, 25 conformes.** Le socle INFRA/CYBER est operationnel et verifie.
Les trois points de vigilance sont des risques assumes et documentes, non des
failles cachees — ils relevent du materiel (WPA2) ou d'une donnee encore
manquante (adresses MAC).

Aucun test n'a ete « theorique » : chaque ligne correspond a une commande
executee et a une sortie lue. Les difficultes traversees pour y arriver sont
consignees dans [INCIDENTS.md](INCIDENTS.md).
