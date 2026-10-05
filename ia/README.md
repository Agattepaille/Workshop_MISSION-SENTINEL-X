# IA

Scripts Python exécutés sur le PC Serveur Local (à venir) :

- **vision** : détection d’une présence humaine sur le flux de la webcam USB
  branchée sur le serveur, avec des images redimensionnées (par exemple 640x480)
  pour rester sous 100 ms par trame ;
- **maintenance prédictive** : détection d’anomalies sur les séries temporelles
  des capteurs par un modèle (par exemple Isolation Forest), et non par des seuils
  statiques.

Les détections seront transmises à l’API.
