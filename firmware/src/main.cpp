#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <DHT.h>
#include "secrets.h"

const int TRIG = D0;
const int ECHO = D5;
const int PIR  = D6;
const int GAZ  = A0; 
DHT dht(D7, DHT22);  

ESP8266WebServer server(80);

float temperature = NAN;
float humidite = NAN;
unsigned long dernierDHT = 0;

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

void setup() {
  Serial.begin(115200);
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
  pinMode(PIR, INPUT);
  dht.begin();

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Connexion au Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("Connecte ! Adresse IP : ");
  Serial.println(WiFi.localIP());

  server.on("/api/sensors", envoyerMesures);
  server.begin();
}

void loop() {
  server.handleClient();

  if (millis() - dernierDHT >= 2000) {
    dernierDHT = millis();
    temperature = dht.readTemperature();
    humidite = dht.readHumidity();
  }
}
