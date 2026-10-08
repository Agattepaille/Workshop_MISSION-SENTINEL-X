#include <Arduino.h>
#include <ESP8266WebServer.h>
#include <DHT.h>
#include "connexion_borne.h"

const int TRIG = D3;
const int ECHO = D5;
const int PIR  = D6;
const int GAZ  = A0;
DHT dht(D4, DHT22);

const int SEGMENTS[7] = {D0, D1, D2, D7, D8, 3, 1};

const uint8_t CHIFFRES[10] = {
  0b0111111, 0b0000110, 0b1011011, 0b1001111, 0b1100110,
  0b1101101, 0b1111101, 0b0000111, 0b1111111, 0b1101111,
};
const uint8_t LETTRE_P = 0b1110011;
const uint8_t TIRET    = 0b1000000;
const uint8_t ETEINT   = 0;

ConnexionBorne borne;
ESP8266WebServer server(80);

float temperature = NAN;
float humidite = NAN;
unsigned long dernierDHT = 0;
unsigned long dernierAffichage = 0;
unsigned long dernierEnvoi = 0;
int dernierEtatPIR = LOW;

void afficher(uint8_t motif) {
  for (int i = 0; i < 7; i++) {
    digitalWrite(SEGMENTS[i], (motif >> i) & 1);
  }
}

void testAfficheur() {
  for (int i = 0; i < 7; i++) {
    afficher(1 << i);
    delay(400);
  }
  for (int c = 0; c < 10; c++) {
    afficher(CHIFFRES[c]);
    delay(300);
  }
  afficher(ETEINT);
}

void afficherFinIP() {
  String fin = String(WiFi.localIP()[3]);
  for (unsigned int i = 0; i < fin.length(); i++) {
    afficher(CHIFFRES[fin[i] - '0']);
    delay(800);
    afficher(ETEINT);
    delay(200);
  }
}

float lireDistance() {
  digitalWrite(TRIG, LOW);  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH); delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  long duree = pulseIn(ECHO, HIGH, 30000);
  return duree * 0.0343 / 2;
}

String nombreOuNull(float valeur) {
  return isnan(valeur) ? String("null") : String(valeur, 1);
}

void envoyerMesures() {
  float cm = lireDistance();
  String json = "{";
  json += "\"dht22\":{\"temperature\":" + nombreOuNull(temperature);
  json += ",\"humidity\":" + nombreOuNull(humidite) + "},";
  json += "\"mq2\":{\"gasRaw\":" + String(analogRead(GAZ)) + "},";
  json += "\"pir\":{\"motion\":" + String(digitalRead(PIR) ? "true" : "false") + "},";
  json += "\"hcsr04\":{\"distanceCm\":" + (cm == 0 ? String("null") : String(cm, 1)) + "}";
  json += "}";
  server.send(200, "application/json", json);
}

void envoyerEtat() {
  server.send(200, "application/json", borne.resume());
}

String construireTrame() {
  String mesures = "";
  auto ajouter = [&mesures](const char *nom, const String &valeur) {
    if (mesures.length() > 0) mesures += ",";
    mesures += "\"" + String(nom) + "\":" + valeur;
  };
  if (!isnan(temperature)) ajouter("temperature_c", String(temperature, 1));
  if (!isnan(humidite)) ajouter("humidity_pct", String(humidite, 1));
  ajouter("gas_raw", String(analogRead(GAZ)));
  float cm = lireDistance();
  if (cm > 0) ajouter("distance_cm", String(cm, 1));

  String trame = "{";
  trame += "\"timestamp\":\"" + horodatage() + "\",";
  trame += "\"measurements\":{" + mesures + "},";
  trame += "\"sensor_states\":{\"motion\":" + String(digitalRead(PIR) ? "true" : "false") + "}";
  trame += "}";
  return trame;
}

void setup() {
  for (int i = 0; i < 7; i++) {
    pinMode(SEGMENTS[i], OUTPUT);
  }
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
  pinMode(PIR, INPUT);
  dht.begin();

  testAfficheur();

  borne.demarrer();
  int tour = 0;
  while (WiFi.status() != WL_CONNECTED) {
    afficher(1 << (tour % 6));
    tour++;
    delay(150);
  }
  afficherFinIP();

  unsigned long debut = millis();
  while (!heureValide() && millis() - debut < 20000) {
    afficher((millis() / 300) % 2 ? TIRET : ETEINT);
    delay(50);
  }
  afficher(ETEINT);

  server.on("/api/sensors", envoyerMesures);
  server.on("/api/status", envoyerEtat);
  server.begin();
}

void loop() {
  server.handleClient();
  borne.entretenir();

  if (millis() - dernierDHT >= 2000) {
    dernierDHT = millis();
    temperature = dht.readTemperature();
    humidite = dht.readHumidity();
  }

  int etatPIR = digitalRead(PIR);
  bool changementPIR = etatPIR != dernierEtatPIR;
  dernierEtatPIR = etatPIR;
  if (borne.connectee() && (changementPIR || millis() - dernierEnvoi >= PERIODE_ENVOI_MS)) {
    dernierEnvoi = millis();
    borne.publier(construireTrame());
  }

  if (millis() - dernierAffichage >= 300) {
    dernierAffichage = millis();
    if (etatPIR) {
      afficher(LETTRE_P);
    } else {
      float cm = lireDistance();
      afficher(cm == 0 ? TIRET : CHIFFRES[min(9, (int)(cm / 10))]);
    }
  }
}
