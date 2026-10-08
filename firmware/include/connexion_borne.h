#pragma once

#include <ESP8266WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <time.h>
#include "config.h"
#include "secrets.h"

inline bool heureValide() {
  return time(nullptr) >= HEURE_MINIMALE;
}

inline String horodatage() {
  time_t maintenant = time(nullptr);
  struct tm utc;
  gmtime_r(&maintenant, &utc);
  char texte[21];
  strftime(texte, sizeof(texte), "%Y-%m-%dT%H:%M:%SZ", &utc);
  return String(texte);
}

class ConnexionBorne {
 public:
  ConnexionBorne()
      : certificatCA(MQTT_CA_PEM),
        certificatCarte(MQTT_CLIENT_CERT_PEM),
        cleCarte(MQTT_CLIENT_KEY_PEM),
        mqtt(connexionTLS) {}

  void demarrer() {
    WiFi.persistent(false);
    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(true);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    configTime(0, 0, NTP_SERVER);
    connexionTLS.setTrustAnchors(&certificatCA);
    connexionTLS.setClientECCert(&certificatCarte, &cleCarte, BR_KEYTYPE_KEYX | BR_KEYTYPE_SIGN, BR_KEYTYPE_EC);
    IPAddress ipBroker;
    ipBroker.fromString(MQTT_HOST);
    mqtt.setServer(ipBroker, MQTT_PORT);
    mqtt.setBufferSize(512);
  }

  void entretenir() {
    if (WiFi.status() != WL_CONNECTED) {
      etat = "wifi deconnecte";
      return;
    }
    if (!heureValide()) {
      etat = "heure non synchronisee";
      return;
    }
    if (mqtt.connected()) {
      mqtt.loop();
      return;
    }
    if (dejaTente && millis() - derniereTentative < 5000) {
      return;
    }
    dejaTente = true;
    derniereTentative = millis();
    connecter();
  }

  bool connectee() {
    return mqtt.connected();
  }

  void ecouterCommandes(MQTT_CALLBACK_SIGNATURE) {
    mqtt.setCallback(callback);
    ecoute = true;
  }

  bool publierSur(const char *topic, const String &contenu, bool retenu = false) {
    if (!mqtt.connected()) {
      return false;
    }
    return mqtt.publish(topic, contenu.c_str(), retenu);
  }

  bool publier(const String &trame) {
    if (!mqtt.connected()) {
      return false;
    }
    bool envoye = mqtt.publish(MQTT_TOPIC, trame.c_str());
    if (envoye) {
      envois++;
    }
    return envoye;
  }

  String resume() {
    String json = "{";
    json += "\"device_id\":\"" DEVICE_ID "\",";
    json += "\"ip\":\"" + WiFi.localIP().toString() + "\",";
    json += "\"heure\":\"" + (heureValide() ? horodatage() : String("non synchronisee")) + "\",";
    json += "\"mqtt\":{\"connecte\":" + String(mqtt.connected() ? "true" : "false");
    json += ",\"etat\":\"" + etat + "\"";
    json += ",\"envois\":" + String(envois) + "}";
    json += "}";
    return json;
  }

  String etat = "demarrage";
  unsigned long envois = 0;

 private:
  void connecter() {
    connexionTLS.setX509Time(time(nullptr));
    bool connecte = false;
    if (!presenceRefusee) {
      connecte = mqtt.connect(DEVICE_ID, MQTT_USER, MQTT_PASSWORD, TOPIC_PRESENCE, 1, true, "{\"online\":false}");
      if (!connecte && mqtt.state() == MQTT_CONNECT_UNAUTHORIZED) {
        presenceRefusee = true;
      }
    }
    if (!connecte && presenceRefusee) {
      connecte = mqtt.connect(DEVICE_ID, MQTT_USER, MQTT_PASSWORD);
    }
    if (connecte) {
      etat = presenceRefusee ? "connecte, presence refusee par l'ACL" : "connecte";
      if (!presenceRefusee) {
        mqtt.publish(TOPIC_PRESENCE, "{\"online\":true}", true);
      }
      if (ecoute) {
        mqtt.subscribe(TOPIC_COMMANDES, 1);
      }
      return;
    }
    etat = "echec, code " + String(mqtt.state());
    char erreurTLS[64];
    int codeTLS = connexionTLS.getLastSSLError(erreurTLS, sizeof(erreurTLS));
    if (codeTLS != 0) {
      etat += ", TLS " + String(codeTLS) + " " + String(erreurTLS);
    }
  }

  BearSSL::X509List certificatCA;
  BearSSL::X509List certificatCarte;
  BearSSL::PrivateKey cleCarte;
  BearSSL::WiFiClientSecure connexionTLS;
  PubSubClient mqtt;
  bool dejaTente = false;
  bool ecoute = false;
  bool presenceRefusee = false;
  unsigned long derniereTentative = 0;
};
