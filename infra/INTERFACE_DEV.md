# Interface DEV / IA

Ce document s'adresse aux equipes **Developpement** et **Intelligence
Artificielle**. Il decrit comment dialoguer avec l'infrastructure sans avoir a
la connaitre.

## 1. En une phrase

> Vos donnees entrent et sortent par un seul canal : le broker MQTT, en
> **MQTTS** (TLS) sur le port **8883**.

## 2. Comment publier depuis un ESP8266

Trois elements sont necessaires :

| Element | Fourni par | Comment |
|---|---|---|
| Certificat `ca.crt` | INFRA | Remis **hors Git**, a embarquer dans le firmware |
| Identifiant + mot de passe (`esp`) | INFRA | Fournis separement, jamais dans le code source |
| Adresse du broker | ce document | `10.73.42.1`, port `8883` |

Canaux de donnees :

| Sens | Canal |
|---|---|
| ESP → serveur (mesures) | `sentinel/table/sensors/<id_table>` |
| Serveur → ESP (ordres) | `sentinel/table/actuators/<id_table>` |

> Le canal impose `<id_table>` : il permettra de distinguer les tables.

```cpp
// Cote ESP : principe general
// 1. se connecter au WiFi de la borne
// 2. configurer la racine de confiance (ca.crt) dans le client WiFi
// 3. se connecter au broker sur le port 8883 avec l'utilisateur 'esp'
// 4. publier sur sentinel/table/sensors/<id_table>
```

**Point de vigilance TLS** : sans la verification du certificat cote ESP, le
chiffrement serait vulnerable a une interception. La verification de la chaine
de confiance n'est pas optionnelle.

## 3. Limites a respecter

Votre `esp` peut **ecrire** sur `sensors/#` et **lire** sur `actuators/#` :

- il ne peut pas lire les capteurs des autres tables (ACL) ;
- il ne peut pas publier d'ordres sur `actuators/#` ;
- une connexion anonyme est refusee.

Si un besoin fonctionnel depasse ces limites, demandez une modification d'ACL
plutot que de contourner la securite.

## 4. Cote IA (Python)

L'utilisateur dedie est `ia`, en MQTTS sur le port `8883` :

```python
import paho.mqtt.client as mqtt

client = mqtt.Client(client_id="ia-modele")
client.username_pw_set("ia", "<mot_de_passe_fourni>")
client.tls_set(ca_certs="ca.crt")       # indispensable
client.connect("10.73.42.1", 8883)
client.subscribe("sentinel/table/sensors/#")
client.loop_forever()
```

Les donnees sont stockees dans **InfluxDB** via Telegraf ; on y accede en Flux
sur `http://127.0.0.1:8086`.

## 5. Supervision

Dashboard : `https://grafana.nyasaoto.dev` (compte `equipe`, lecture seule).

Il couvre **l'infrastructure** : CPU, memoire, disque, conteneurs, charge du
broker. Pour lire les **donnees capteurs**, utilisez l'API ou InfluxDB — pas
ce tableau de bord, qui est reserve a la sante du serveur.

## 6. Questions frequentes

**« Je n'arrive pas a me connecter »** : verifiez d'abord que vous etes sur le
bon WiFi et que `ca.crt` correspond bien a celui fourni, avant de suspecter
l'infrastructure.

**« Je veux un nouveau topic »** : proposez-le, l'ACL sera mise a jour. C'est
plus sur que d'ouvrir un jocker.
