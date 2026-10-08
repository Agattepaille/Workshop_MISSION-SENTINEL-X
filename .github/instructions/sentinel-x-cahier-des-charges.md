# Cahier des charges de référence — Workshop national SENTINEL-X

Le cahier des charges complet du workshop est reproduit ci-dessous. Il donne le
contexte du projet et de ses livrables. Pour les tâches confiées à cet agent,
priorise le périmètre API REST et dashboard défini plus haut, tout en respectant
les contraintes d’intégration, de sécurité et de démonstration décrites ici.

## Sujet de Workshop national — BAC+4

**Mission SENTINEL-X : L’Avant-Poste Industriel du Futur**  
Apprenants Mastère 1ère Année • Sprint d’ingénierie (4 jours) • Octobre 2026  
Direction Pédagogique Nationale EPSI

## 1. Contexte global et enjeux

En ce début d’année 2050, la multinationale AetherCorp Industrial Solutions
fait face à une crise sécuritaire majeure. Déployant des micro-centrales
énergétiques éco-responsables dans des zones géographiques isolées et
particulièrement hostiles, l’entreprise subit une recrudescence d’attaques
coordonnées. Ces infrastructures critiques font l’objet de trois menaces
simultanées : des cyberattaques de déstabilisation réseau, des intrusions
physiques d’espionnage industriel et des risques environnementaux critiques
comme des fuites de gaz combustibles ou des surchauffes thermiques.

Face à l’impossibilité d’acheminer du personnel humain en permanence, AetherCorp
lance l’initiative SENTINEL-X. L’objectif est de concevoir un boîtier de
surveillance physique autonome (Edge Node) capable de s’interfacer sans fil et
de manière ultra-sécurisée avec un Centre de Commandement Tactique, matérialisé
par un PC Serveur Local durci sur le terrain.

Chaque équipe du Workshop se constitue sous la forme d’un consortium
d’ingénieurs indépendants chargé de livrer un prototype industriel
cyber-physique complet : boîtier physique équipé, traitement algorithmique
d’intelligence artificielle, infrastructure système conteneurisée, application
de supervision réactive et protocole de sécurité défensive globale.

### Définition et rôle du PC Serveur Local

L’expression « PC Serveur Local » désigne le cœur de calcul central du système
de table. Selon l’option matérielle retenue par le groupe le lundi matin, ce
rôle sera physiquement assuré soit par une carte Raspberry Pi 5 intégrée au
boîtier, soit directement par l’ordinateur portable d’un apprenant, faisant
office de serveur et de point d’accès Wi-Fi sur la table.

Dans tous les cas, le flux vidéo est capté exclusivement par une webcam USB
connectée en direct sur ce PC Serveur Local.

### Les quatre piliers technologiques du projet

- **Edge Computing & IoT :** programmation d’un microcontrôleur unique pour la
  captation de données et la gestion d’alertes physiques et visuelles de table.
- **Intelligence Artificielle Locale :** analyse d’images réseau en temps réel
  et détection comportementale ou prédictive sur séries temporelles.
- **Infrastructure & Centralisation :** orchestration de conteneurs serveurs
  résilients et sécurisation des protocoles d’ingestion.
- **Cybersécurité :** chiffrement de bout en bout, durcissement (hardening)
  système et audit offensif par pentest croisé.

## 2. Spécifications techniques et exemples par filière

Chaque équipe fonctionne comme un studio d’ingénierie pluridisciplinaire mixte.
L’interconnexion fonctionnelle de chaque bloc est un prérequis éliminatoire
pour valider la démonstration finale du vendredi.

### 1° EISI DEV — Conception et développement d’applications

**Programmation IoT et micrologiciel :** écriture exclusive du micrologiciel
(firmware) en C++ (Arduino IDE ou CLion/VS Code + PlatformIO) pour l’unique
module microcontrôleur ESP8266 de table. Gestion de la lecture cadencée des
capteurs, de l’affichage local sur l’écran OLED I2C et de la structuration des
payloads de données.

**Backend et API :** développement d’une API REST et/ou WebSocket réactive
(Node.js, Python ou Go) hébergée sur le PC Serveur Local pour centraliser les
métriques de sécurité et l’historique des événements.

Exemple : point d’entrée JSON obligatoire `POST /api/v1/alerts` pour réceptionner
les changements d’états des capteurs de table.

**Dashboard de supervision :** conception d’une interface Web moderne (React,
Vue.js ou JavaScript natif) affichant les courbes environnementales en temps
réel, le statut logique du boîtier et le retour visuel de la webcam USB.

**Contrôle réactif :** implémentation d’un panneau de commande permettant au
superviseur de déclencher à distance des actionneurs physiques raccordés à
l’ESP8266 (buzzer d’alarme, LEDs de statut).

### 2° EISI IA — Intelligence artificielle et data

**Vision intelligente :** écriture d’un script Python autonome s’exécutant sur
le PC Serveur Local. Ce script doit capter le flux vidéo de la webcam USB
branchée en direct sur le serveur, appliquer un modèle d’inférence (ex. :
YOLOv8-tiny ou détection de formes OpenCV) et isoler en temps réel une présence
humaine suspecte dans la zone.

**Maintenance prédictive :** analyse des séries temporelles des capteurs
transmises par l’ESP8266. Interdiction d’utiliser de simples structures
conditionnelles statiques (ex. : `if temp > 40`). Développement d’un modèle
algorithmique (ex. : Isolation Forest, Random Forest via Scikit-Learn) capable
de détecter les anomalies cinétiques.

Exemple : détection d’une corrélation suspecte entre une hausse lente de
température et une micro-déviation de gaz, prédisant un incident avant le seuil
d’alerte critique.

**Optimisation des flux :** bridage et redimensionnement systématique des
images de la webcam en amont (ex. : 640×480) pour maintenir un traitement fluide
inférieur à 100 ms par trame.

### 3° EISI INFRA — Réseau, systèmes et ASRBD

**Virtualisation de l’infrastructure :** orchestration, configuration et
déploiement automatisé de l’ensemble de la stack serveur (base de données
relationnelle ou NoSQL, API DEV et broker MQTT Mosquitto) sous forme de
conteneurs isolés et pérennes via Docker Compose sur le PC Serveur Local.

**Routage et topologie de table :** déploiement et configuration d’un point
d’accès Wi-Fi local dédié à la table de l’équipe. Conception complète du plan
d’adressage IP, gestion des masques, isolation réseau et routage étanche des
flux pour empêcher l’interférence avec les autres groupes.

Exemple de configuration : sous-réseau de table étanche sur une plage dédiée
(ex. : `192.168.10.0/24`) isolant les paquets de l’ESP8266 vers le PC Serveur
Local.

**Monitoring et MCO :** surveillance du maintien en condition opérationnelle de
la machine hôte (consommation CPU/RAM, gestion des volumes de logs MQTT) face à
l’afflux continu des messages.

### 4° CYBER — Cybersécurité

**Sécurisation des flux :** implémentation obligatoire du chiffrement des
trames de bout en bout (TLS pour MQTT vers MQTTS ou HTTPS) entre l’appareil IoT
physique ESP8266 de collecte et la stack conteneurisée.

**Hardening système :** sécurisation drastique du système d’exploitation jouant
le rôle de serveur (fermeture des ports non requis via UFW/iptables,
interdiction d’accès SSH par mot de passe au profit de clés asymétriques
publiques/privées et isolation stricte des privilèges des daemons Docker).

**Audit et pentest offensif :** conduite de l’audit de sécurité lors de la
journée du jeudi. Utilisation d’outils professionnels (Nmap, Wireshark,
Metasploit) pour mener des attaques de l’homme du milieu (MitM), des injections
de payloads ou des dénis de service (DoS) sur les infrastructures des groupes
concurrents lors du pentest croisé.

## 3. Matériel et configurations techniques élémentaires

Chaque consortium dispose des équipements suivants pour assembler son
infrastructure de table :

- **Module microcontrôleur ESP8266 :** centralise la collecte complète des
  données environnementales de la table et pilote les alertes physiques
  locales.
- **Webcam USB classique :** connectée directement au PC Serveur Local pour la
  capture et le traitement du flux vidéo destiné à l’IA.
- **Capteurs environnementaux :** 1× DHT22 (température/humidité), 1× MQ-2
  (gaz/fumées), 1× PIR HC-SR501 (présence), connectés directement à l’ESP8266.
- **Interfaces et alertes électroniques :** 1× écran OLED I2C de 0,96 pouce
  pour afficher le statut IP/Wi-Fi, buzzers piézoélectriques, LEDs de statut,
  breadboards et jumpers.
- **Machines numériques (myDiL) :** imprimantes 3D Creality K2 Plus et graveuse/
  découpeuse laser Creality Falcon A1.

### Option technique A — Centralisation embarquée (Raspberry Pi 5)

Le PC Serveur Local est matérialisé par une carte Raspberry Pi 5 (4 Go de RAM)
fixée à l’intérieur du boîtier imprimé en 3D. Le Raspberry Pi exécute la pile
Docker Compose et prend en charge l’exécution locale du script d’intelligence
artificielle de vision par ordinateur via la webcam USB raccordée sur la carte.
Le module ESP8266 se connecte en Wi-Fi à ce Raspberry Pi.

### Option technique B — Topologie distribuée « Edge-to-Server » (PC apprenant)

Le Raspberry Pi est entièrement retiré. Le rôle de PC Serveur Local est alors
assuré par l’ordinateur portable d’un apprenant. La caméra USB est reliée
directement à son PC, et l’intelligence artificielle profite des capacités
matérielles (CPU/GPU) de sa machine pour s’exécuter. Le boîtier physique
SENTINEL-X ne contient que l’ESP8266 et ses composants de captation
électronique, transmettant leurs flux Wi-Fi à l’adresse IP de ce PC Serveur.

## 4. Chronologie appliquée de la semaine (sprint)

- **Lundi — Kick-off, idéation et design :** présentation officielle du cahier
  des charges, constitution des consortiums mixtes (4 à 6 personnes maximum).
  Validation obligatoire des schémas d’architecture réseau et des flux de
  données par les coachs de campus. Lancement des premières modélisations CAO.
- **Mardi — Production core et développement :** câblage des composants sur
  plaques d’essai. Déploiement et configuration des conteneurs système (EISI
  INFRA) sur le PC Serveur Local. Écriture du firmware ESP8266 et architecture
  de l’API (EISI DEV). Entraînement initial des modèles IA (EISI IA).
- **Mercredi — Intégration globale et studio vidéo :** interconnexion des
  systèmes (Edge-to-Server). Les données des capteurs physiques doivent
  modifier en temps réel les graphiques de l’interface Web et l’IA doit
  analyser la webcam. Après-midi dédié au tournage du teaser « Sentinel Drop »
  sur fond vert.
- **Jeudi — Hacking Day et audit de sécurité :** matinée dédiée au gel du code
  et aux finitions esthétiques du boîtier au Fablab. L’après-midi est consacré
  au pentest croisé national : chaque groupe tente de corrompre et de faire
  tomber les systèmes des autres tables. Rédaction du rapport d’audit.
- **Vendredi — Évaluation locale et soutenances :** soutenances des équipes
  devant le jury local, démonstrations fonctionnelles en direct et annonce des
  résultats du campus pour désigner le consortium champion.

## 5. Consignes de fabrication numérique et rapport marketing vivant (Fablab)

Le livrable final ne doit pas se restreindre à du code abstrait ou à des
maquettes logicielles. Les apprenants doivent matérialiser leur concept au sein
du Fablab :

1. **Modélisation et impression 3D :** conception de la coque de protection sur
   Fusion360 exclusivement. Le boîtier doit encapsuler proprement l’électronique
   de table (ESP8266, capteurs), laisser apparaître l’écran OLED et proposer des
   passes-câbles propres sans fils apparents.
2. **Gravure laser industrielle :** utiliser la machine de découpe/gravure laser
   pour apposer sur le boîtier (plexiglas, bois ou carton épais) le logo
   d’AetherCorp, les consignes de sécurité et le numéro de série du module afin
   de lui conférer un aspect de produit fini.
3. **Teaser « Sentinel Drop » (studio vidéo fond vert) :** chaque équipe doit
   scénariser, tourner et monter une vidéo promotionnelle technique au format
   vertical (9:16, type Instagram Reel, TikTok ou YouTube Short) d’une durée
   stricte de 60 secondes maximum.

### Structure et objectifs du format vidéo de 60 secondes

Ce livrable est un rapport de produit commercialisé vivant, expliquant et
valorisant le produit fini en moins d’une minute :

- **00–10 s — Hook métier :** présentation de la menace sur les centrales
  AetherCorp (ambiance d’alerte, sirène) pour capter immédiatement l’attention
  du jury.
- **10–30 s — Présentation du produit physique :** gros plans (B-roll) sur le
  boîtier SENTINEL-X finalisé, imprimé au Fablab et gravé au laser, mettant en
  valeur l’intégration de l’écran OLED et des capteurs.
- **30–50 s — Démonstration de la stack d’incrustation :** exploitation
  obligatoire de la salle fond vert. Les apprenants s’incrustent au premier
  plan avec, derrière eux, des schémas d’architecture animés, des flux de code
  réels (firmware C++, API Docker) ou l’interface de vision de l’IA (YOLO)
  isolant un intrus. L’objectif est de vulgariser visuellement l’intelligence
  embarquée.
- **50–60 s — Appel à l’action et outro :** alignement de l’équipe face caméra
  incarnant le consortium d’ingénieurs AetherCorp.

Signature : « Sentinel-X : la sécurité à la bordure. »

**Rendu exigé :** fichier MP4 vertical natif encodé proprement en H.264.

## 6. Rendus impératifs

L’ensemble des livrables numériques doit être déposé dans un dossier unique
nommé `Workshop2026-M1-G<n>`, en remplaçant `<n>` par le numéro de groupe, le
jeudi soir à l’échéance fixée par les coachs de campus (lien vers le dossier
communiqué le lundi par les coachs) :

- **Rapport d’Ingénierie Technique :** document unique au format PDF nommé
  `Workshop2026-M1-G<n>-Dossier.pdf`, comprenant le schéma réseau, le schéma de
  câblage électronique, la matrice de sécurité (hardening, TLS), la
  documentation de l’IA et le rapport d’audit post-pentest. Inclure un poster
  format A3 en annexe.
- **Support de Présentation :** fichier PowerPoint nommé
  `Workshop2026-M1-G<n>-Pres.pptx` servant de support visuel à l’oral pour la
  soutenance du vendredi.
- **Vidéo « Sentinel Drop » :** fichier vidéo vertical `.mp4` de 60 secondes
  nommé `Workshop2026-M1-G<n>-VidDrop.mp4`.
- **Archive du code :** zip nommé `Workshop2026-M1-G<n>-Code.zip` du dépôt
  GitHub/GitLab, propre et structuré, contenant un `README.md` exhaustif. Aucun
  secret ni aucune clé d’authentification en clair.
- **Prototype SENTINEL-X :** boîtier physique fonctionnel équipé de son
  électronique, prêt pour la démonstration en direct devant le jury, à déposer
  au myDiL le vendredi matin à l’échéance fixée par les coachs de campus.

## 7. Cadre d’évaluation locale (semaine de sprint)

La note globale locale est calculée selon la pondération suivante :

`((Note Individuelle Suivi × 1) + (Note Collective Jury × 2)) / 3`

### Suivi de réalisation hebdomadaire (coachs, lundi au jeudi)

Évaluation continue individuelle, note sur 20 points (coefficient 1). Chaque
critère est évalué sur le barème ND/1/2/3 puis ramené sur un nombre de points :

- Engagement, assiduité et posture : 4 points.
- Expertise technique de la filière : 4 points.
- Agilité et autonomie : 4 points.
- Collaboration transversale : 4 points.
- Rigueur d’ingénierie et Git : 4 points.

### Soutenance et démonstration locale (jury, vendredi)

Évaluation collective de l’équipe, note sur 20 points (coefficient 2) :

- Axe 1 — Démo live et intégration globale : 5 points.
- Axe 2 — Technicité, innovation et sécurité : 4 points.
- Axe 3 — Marketing et teaser « Sentinel Drop » : 4 points.
- Axe 4 — Posture, storytelling et pitch : 4 points.
- Axe 5 — Qualité documentaire et Q&A : 3 points.

Indicateurs d’excellence attendus :

- Stabilité du flux complet en direct (ESP8266 vers PC Serveur Local) et
  réactivité immédiate du dashboard aux alertes.
- Preuve matérielle du chiffrement des flux, niveau d’inférence de l’IA sur la
  webcam et durcissement prouvé du serveur.
- Impact visuel du clip de 60 secondes, propreté de l’incrustation fond vert,
  finitions esthétiques du boîtier Fablab (gravure laser).
- Clarté de l’exposé, dynamisme de l’équipe, professionnalisme et respect du
  temps imparti de 5 minutes.
- Rigueur et exhaustivité du dossier technique remis, précision des réponses
  techniques lors de la phase de questions.

### Chrono de passage local (5 minutes de live + 5 minutes de présentation et Q&A)

- **Minute 1 (0:00–1:00) — Présentation :** introduction de l’équipe et rappel
  de la variante d’architecture sélectionnée.
- **Minute 2 (1:00–2:00) — Projection :** diffusion du teaser vidéo vertical
  « Sentinel Drop » (60 secondes).
- **Minutes 3 à 5 (2:00–5:00) — Démo live locale :** démonstration technique en
  direct de SENTINEL-X, avec génération d’alertes capteurs et détection IA de
  la webcam en temps réel à l’écran.
- **Minutes 6 à 10 (5:00–10:00) — Pitch et Q&A :** présentation détaillée du
  fonctionnement, des capteurs, du code, de l’IA et des indicateurs, avec
  support PowerPoint. Le jury peut intervenir librement.

## 8. Cadre d’évaluation nationale (finale live Teams)

Le 17 novembre 2026, six semaines après la finale locale, les 10 consortiums
champions de chaque campus se mesurent en direct lors de la finale nationale
sur Microsoft Teams devant les campus interconnectés.

### Chrono national (5 minutes maximum par équipe)

Le non-respect du temps alloué entraîne l’interruption immédiate du flux par le
modérateur national :

- **Minute 1 (0:00–1:00) — Présentation :** introduction synchrone de l’équipe
  et rappel de la variante d’architecture sélectionnée.
- **Minute 2 (1:00–2:00) — Projection :** diffusion du teaser vidéo vertical
  « Sentinel Drop » (60 secondes).
- **Minutes 3 à 5 (2:00–5:00) — Démo live nationale :** démonstration technique
  en direct de SENTINEL-X, avec génération d’alertes capteurs et détection IA
  de la webcam en temps réel à l’écran. Pas de diaporamas statiques, uniquement
  de la production live.

### Étape 1 — Grille d’évaluation technique critériée (70 points)

- Démonstration produit en live : 25 points.
- Vulgarisation et posture de pitch : 20 points.
- Complexité technique et innovation : 15 points.
- Impact visuel du « Drop » (vidéo) : 10 points.

Indicateurs recherchés : visibilité claire de la stack technique à l’écran,
réactivité réseau instantanée, absence de plantage, régularité et clarté du
débit de parole, dynamisme, force de persuasion à distance, robustesse
apparente du lien ESP8266 vers serveur, intégration propre de la couche de
chiffrement et de l’IA, qualité de l’incrustation vidéo et design esthétique du
boîtier Fablab.

### Étape 2 — Scrutin national croisé (capital de 43 points)

Deux jurys locaux par campus (20 jurys nationaux au total) compilent leurs
grilles techniques et établissent leur classement final de la 1ère à la 10ème
place. Chaque jury distribue obligatoirement son capital de 43 points selon la
grille suivante :

| Rang | Points |
|---|---:|
| 1er | 12 |
| 2ème | 10 |
| 3ème | 8 |
| 4ème | 6 |
| 5ème | 4 |
| 6ème | 2 |
| 7ème | 1 |
| 8ème, 9ème et 10ème | 0 |

**Règle de neutralité :** un jury local n’a pas le droit de voter pour le groupe
de son propre campus. Le campus local doit faire partie des trois groupes
recevant 0 point, avec les deux campus les moins bien notés sur la grille
critériée du jury. Le cumul des points de scrutin de tous les jurys désigne le
vainqueur national.

## 9. Règlement appliqué et savoir-être

Consignes administratives et de sécurité impératives :

- **Émargement électronique :** chaque apprenant doit valider sa présence sur
  Edusign dans les 15 premières minutes de chaque demi-journée de travail
  (matin et après-midi), sous peine de pénalité de suivi.
- **Savoir-vivre et cadre de travail :** salles de cours et laboratoires
  d’innovation (myDiL) maintenus dans un état de propreté irréprochable. Trier
  et évacuer chaque soir tous les déchets, chutes de prototypage et restes de
  repas.
- **Obligation de présence aux évaluations :** présence de la totalité des
  apprenants du campus obligatoire pendant toute la durée des soutenances
  locales du vendredi, l’annonce des résultats du campus et l’intégralité de
  la retransmission de la finale nationale sur Teams pour soutenir l’équipe
  championne.

## 10. Annexe — signification du barème ND/1/2/3

- **ND :** Niveau Non Démontré.
- **Niveau 1 :** Peu satisfaisant.
- **Niveau 2 :** Satisfaisant, conforme aux attendus.
- **Niveau 3 :** Très satisfaisant, au-delà des attendus.
