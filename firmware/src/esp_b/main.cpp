#include <Arduino.h>
#include <ESP8266WebServer.h>
#include <ArduinoJson.h>
#include "connexion_borne.h"

ConnexionBorne borne;
ESP8266WebServer server(80);

unsigned long dernierEnvoi = 0;
bool dejaConnectee = false;

const int BUZZER = 10;
bool buzzerActif = false;
unsigned long finBuzzer = 0;
unsigned long nbCommandes = 0;
String derniereCommande = "aucune";

const int MOTEUR_1[4] = {D1, D2, D5, D6};
const int MOTEUR_2[4] = {D7, D0, 1, 3};

const uint8_t DEMI_PAS[8] = {0b1000, 0b1100, 0b0100, 0b0110, 0b0010, 0b0011, 0b0001, 0b1001};
const long DEMI_TOUR = 2048;

void bip(int dureeMs) {
  digitalWrite(BUZZER, HIGH);
  delay(dureeMs);
  digitalWrite(BUZZER, LOW);
}

void bipperFinIP() {
  int fin = WiFi.localIP()[3] % 10;
  for (int i = 0; i < fin; i++) {
    bip(150);
    delay(250);
  }
}

void demarrerBuzzer(unsigned long dureeMs) {
  digitalWrite(BUZZER, HIGH);
  buzzerActif = true;
  finBuzzer = millis() + dureeMs;
}

void entretenirBuzzer() {
  if (buzzerActif && (long)(millis() - finBuzzer) >= 0) {
    digitalWrite(BUZZER, LOW);
    buzzerActif = false;
  }
}

void couperMoteur(const int moteur[4]) {
  for (int i = 0; i < 4; i++) {
    digitalWrite(moteur[i], LOW);
  }
}

void tourner(const int moteur[4], long demiPas) {
  long n = labs(demiPas);
  for (long k = 0; k < n; k++) {
    int etape = demiPas > 0 ? k % 8 : 7 - (k % 8);
    for (int i = 0; i < 4; i++) {
      digitalWrite(moteur[i], (DEMI_PAS[etape] >> (3 - i)) & 1);
    }
    delay(1);
  }
  couperMoteur(moteur);
}

void repondre(const char *commandId, const char *erreur) {
  JsonDocument reponse;
  reponse["command_id"] = commandId;
  if (erreur == nullptr) {
    reponse["status"] = "completed";
  } else {
    reponse["status"] = "failed";
    reponse["error"] = erreur;
  }
  String texte;
  serializeJson(reponse, texte);
  borne.publierSur(TOPIC_RESULTATS, texte);
}

void recevoirCommande(char *topic, uint8_t *contenu, unsigned int longueur) {
  JsonDocument commande;
  if (deserializeJson(commande, contenu, longueur)) {
    return;
  }
  const char *commandId = commande["command_id"] | "";
  const char *action = commande["action"] | "";
  if (strlen(commandId) == 0) {
    return;
  }
  nbCommandes++;
  derniereCommande = action;

  if (strcmp(commande["device_id"] | DEVICE_ID, DEVICE_ID) != 0) {
    repondre(commandId, "commande destinee a une autre carte");
    return;
  }
  if (strcmp(action, "buzzer.trigger") == 0) {
    unsigned long duree = commande["duration_ms"] | 5000UL;
    demarrerBuzzer(min(duree, (unsigned long)DUREE_BUZZER_MAX_MS));
    repondre(commandId, nullptr);
    return;
  }
  repondre(commandId, "action non prise en charge par " DEVICE_ID);
}

String construireTrame() {
  String trame = "{";
  trame += "\"timestamp\":\"" + horodatage() + "\",";
  trame += "\"measurements\":{\"rssi_dbm\":" + String(WiFi.RSSI()) + ",\"uptime_s\":" + String(millis() / 1000) + "},";
  trame += "\"sensor_states\":{\"buzzer\":" + String(buzzerActif ? "true" : "false") + ",\"moteur_1\":false,\"moteur_2\":false}";
  trame += "}";
  return trame;
}

void envoyerEtat() {
  String json = borne.resume();
  json.remove(json.length() - 1);
  json += ",\"commandes\":{\"recues\":" + String(nbCommandes);
  json += ",\"derniere\":\"" + derniereCommande + "\"";
  json += ",\"buzzer\":" + String(buzzerActif ? "true" : "false") + "}}";
  server.send(200, "application/json", json);
}

void setup() {
  pinMode(BUZZER, OUTPUT);
  digitalWrite(BUZZER, LOW);
  for (int i = 0; i < 4; i++) {
    pinMode(MOTEUR_1[i], OUTPUT);
    pinMode(MOTEUR_2[i], OUTPUT);
  }
  couperMoteur(MOTEUR_1);
  couperMoteur(MOTEUR_2);

  borne.ecouterCommandes(recevoirCommande);
  borne.demarrer();

  server.on("/api/status", envoyerEtat);
  server.begin();
}

void loop() {
  server.handleClient();
  borne.entretenir();
  entretenirBuzzer();

  if (borne.connectee() && !dejaConnectee) {
    dejaConnectee = true;
    bipperFinIP();
  }

  if (borne.connectee() && millis() - dernierEnvoi >= PERIODE_ENVOI_MS) {
    dernierEnvoi = millis();
    borne.publier(construireTrame());
  }
}
