# Journal d'incidents

Six obstacles rencontres lors du deploiement. **Aucun n'est documente dans la
litterature courante** : ils ont chacun coupé le service, et chacun a ete
resolu par une observation, pas par une supposition.

Ils sont consignes pour deux raisons : rendre la reproduction possible, et
montrer comment un incident se traite (constat → cause → correction → preuve).

---

## Incident 1 — MTU et telechargement des images

**Symptome** : `docker compose up -d` echoue pour toutes les images.

```
failed to fetch anonymous token: TLS handshake timeout
```

**Diagnostic** : le RPi passe par le partage de connexion du telephone derriere
un NAT. Un test `curl` vers le registre repondait pourtant correctement —
la connectivite etait donc bonne, et c'est la taille des trames qui posait
probleme : les gros paquets TLS du telechargement etaient fragments puis
abandonnes (MTU).

**Correction** : MTU abaisse dans la configuration du daemon Docker.

```json
{ "mtu": 1400, "log-driver": "journald" }
```

**Preuve** : les 4 conteneurs se sont crees et demarres au premier essai suivant.

---

## Incident 2 — durcissement excessif de Mosquitto

**Symptome** : redemarrage en boucle.

```
chown: /mosquitto/certs/server.crt: Operation not permitted
Error: Duplicate password_file value in configuration.
```

Deux causes distinctes, et c'est un cas d'ecole : en voulant bien faire, on
casse le service.

1. `cap_drop: [ALL]` retirait `CAP_CHOWN`, or l'image Mosquitto reattribue la
   propriete des certificats au demarrage avant de s'executer sous un
   utilisateur non privilegie. **Trop durcir empeche le durcissement.**
2. `password_file` est une option **globale** : la declarer dans chaque
   `listener` declenche une erreur de doublon.

**Correction** : `password_file` et `acl_file` remontes au niveau global, et
les capacites **restituees** sur ce conteneur. Le broker s'execute toujours
sous un utilisateur non privilegie apres l'initialisation : la securite
recherchee est obtenue, sans casser le demarrage.

**Preuve** : `mosquitto version 2.0.22 running`, ecoute sur 1883 et 8883.

---

## Incident 3 — option Telegraf inexistante

**Symptome** : redemarrage en boucle.

```
plugin inputs.cpu: line 4: configuration specified the fields ["total"],
but they were not used
```

**Diagnostic** : l'option `total` du plugin CPU n'existe pas dans cette version.

**Correction** : suppression de l'option, le comportement par defaut convenant.

---

## Incident 4 — Telegraf refuse de demarrer

**Symptome** :

```
setpriv: setresuid failed: Operation not permitted
```

**Diagnostic** : le point d'entree de l'image abandonne ses privileges via
`setpriv`. Avec `cap_drop: [ALL]`, il n'en a plus le droit. Le piege est que la
mesure de securite (retirer les capacites) bloque l'etape meme qui permet de
ne pas tourner en root.

**Correction** : point d'entree remplace par l'appel direct au binaire, ce qui
supprime l'etape de changement d'utilisateur.

```yaml
entrypoint: ["/usr/bin/telegraf","--config","/etc/telegraf/telegraf.conf"]
```

**Preuve** : Telegraf demarre et se connecte au broker
(`Connected [tcp://mosquitto:1883]`).

---

## Incident 5 — variable d'environnement manquante

**Symptome** : Telegraf connecte mais refuse.

```
starting input inputs.mqtt_consumer: not Authorized
```

**Diagnostic** : le mot de passe etait bien defini dans `.env`... mais pas le
**nom d'utilisateur**. La variable etait vide, donc Telegraf se connectait
anonymement et se faisait rejeter. Piege classique : ce n'est pas le secret
qui manquait, c'est l'identifiant.

**Correction** : ajout de `MOSQUITTO_IA_USER=ia`.

> **Lecon** : un `.env` peut paraitre complet et ne pas l'etre. Verifier les
> couples (utilisateur, mot de passe), pas seulement les secrets.

---

## Incident 6 — Grafana injoignable

**Symptome** : `Recv failure: Connection reset by peer` depuis l'hote, alors
que le conteneur etait sain.

**Diagnostic** : le plus instructif des six. Ayant constate que le service
repondait correctement **depuis l'interieur** du conteneur, j'en ai deduit que
le serveur allait bien et que le probleme concernait la publication du port.
La cause : `GF_SERVER_HTTP_ADDR=127.0.0.1` fait ecouter Grafana sur la
loopback **du conteneur**, que le mapping Docker ne relaie pas.

Une premiere hypothese (base SQLite en lecture seule) s'est revelee fausse et
a ete abandonnee des que le test l'a contredite — avant d'empiler les
modifications hasardeuses.

**Correction** : `GF_SERVER_HTTP_ADDR` passe a `0.0.0.0`, l'exposition
restant `127.0.0.1:3000` cote hote. **Rien n'est ouvert vers l'exterieur.**

**Preuve** : `/api/health` repond depuis l'hote (`"database": "ok"`).

Un plugin obsolète (`grafana-clock-panel`), plus distribue, generait
par ailleurs des erreurs au demarrage : il a ete retire, il etait inutile.

---

## Methode

Face a chaque incident, meme demarche :

1. lire le **message d'erreur reel** (pas ce qu'on croit qu'il dit) ;
2. verifier ce qui fonctionne **encore**, pour localiser la panne ;
3. ne changer qu'**une seule chose** a la fois ;
4. **prouver** la correction par une commande, pas par une impression.

C'est aussi ce qui a permis d'eviter le piege du incident 6 : une hypothese
non verifiee (SQLite) aurait conduit a modifier la configuration au mauvais
endroit.
