# Firmware ESP8266

Micrologiciel C++ (PlatformIO) du module ESP8266 (à venir) :

- lecture cadencée des capteurs DHT22 (température/humidité), MQ-2 (gaz/fumée)
  et PIR (présence) ;
- affichage du statut IP/Wi-Fi sur l’écran OLED I2C ;
- envoi des données au PC Serveur Local et pilotage des actionneurs (buzzer, LEDs).

Les identifiants Wi-Fi, les identifiants MQTT et les certificats iront dans
`include/secrets.h`, ignoré par Git. Seul un modèle `include/secrets.example.h`
sera versionné.
