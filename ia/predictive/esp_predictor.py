import requests

from predict import predict_from_esp_json

#l'adresse IP réelle de ton ESP8266
ESP_URL = "http://192.168.1.50/api/sensors"


def get_esp_data():
    response = requests.get(ESP_URL, timeout=5)
    response.raise_for_status()

    return response.json()


def main():

    print("=== MISSION-SENTINEL-X ===")
    print("=== ESP8266 → Isolation Forest ===\n")

    try:

        # 1. Récupération des données ESP8266
        esp_data = get_esp_data()

        print("Données reçues de l'ESP8266 :")
        print(esp_data)

        # 2. Analyse IA
        result = predict_from_esp_json(esp_data)

        print("\nRésultat IA :")
        print(f"Statut : {result['status']}")
        print(f"Score  : {result['score']}")

        print("\nFeatures utilisées :")

        for key, value in result["features"].items():
            print(f"  {key}: {value}")

    except requests.exceptions.RequestException as e:

        print("Erreur de connexion avec l'ESP8266 :")
        print(e)

    except Exception as e:

        print("Erreur :")
        print(e)


if __name__ == "__main__":
    main()