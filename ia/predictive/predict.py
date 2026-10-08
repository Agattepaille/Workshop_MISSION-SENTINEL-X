import time
from pathlib import Path

import joblib

from api_client import get_latest_alert, extract_measurements


BASE_DIR = Path(__file__).resolve().parent

MODEL_PATH = (
    BASE_DIR
    / "models"
    / "isolation_forest_final.joblib"
)


FEATURES = [
    "temperature_c",
    "humidity_pct",
    "gas_raw",
]


def check_configuration():
    """Vérifie que le modèle IA existe."""

    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Modèle introuvable : {MODEL_PATH}"
        )


def prepare_features(measurements):
    """
    Prépare les trois variables utilisées
    par le modèle Isolation Forest.
    """

    return [[
        float(measurements["temperature_c"]),
        float(measurements["humidity_pct"]),
        float(measurements["gas_raw"]),
    ]]


def predict_latest(model):
    """
    Récupère la dernière donnée depuis l'API
    et effectue la prédiction avec Isolation Forest.
    """

    alert = get_latest_alert()

    if alert is None:
        print("⚠ Aucune donnée disponible dans l'API.")
        return None

    try:
        measurements = extract_measurements(alert)
    except (KeyError, TypeError, ValueError) as error:
        print(
            f"⚠ Données de mesure invalides : {error}"
        )
        return None

    X = prepare_features(measurements)

    prediction = model.predict(X)[0]
    score = model.decision_function(X)[0]

    status = (
        "ANOMALIE"
        if prediction == -1
        else "NORMAL"
    )

    timestamp = alert.get("timestamp")
    device_id = alert.get("device_id")

    print()
    print("----------------------------------------")
    print(f"Timestamp    : {timestamp}")
    print(f"Device       : {device_id}")
    print("----------------------------------------")
    print(
        f"Temperature  : "
        f"{measurements['temperature_c']:.2f} °C"
    )
    print(
        f"Humidite     : "
        f"{measurements['humidity_pct']:.2f} %"
    )
    print(
        f"Gaz          : "
        f"{measurements['gas_raw']:.2f}"
    )
    print("----------------------------------------")
    print(f"Prediction   : {status}")
    print(f"Score        : {score:.4f}")
    print("----------------------------------------")

    return {
        "timestamp": str(timestamp),
        "device_id": str(device_id),
        "status": status,
        "score": float(score),
        "features": {
            "temperature_c": float(
                measurements["temperature_c"]
            ),
            "humidity_pct": float(
                measurements["humidity_pct"]
            ),
            "gas_raw": float(
                measurements["gas_raw"]
            ),
        },
    }


def monitor(model, interval=5):
    """
    Surveille l'API périodiquement.

    Une prédiction est effectuée uniquement
    lorsqu'une nouvelle donnée apparaît.
    """

    print()
    print("✓ Surveillance de l'API...")
    print(f"✓ Intervalle : {interval} secondes")
    print()

    last_timestamp = None

    while True:
        try:
            alert = get_latest_alert()

            if alert is None:
                print("⚠ Aucune donnée disponible.")

            else:
                current_timestamp = str(
                    alert.get("timestamp")
                )

                if current_timestamp != last_timestamp:

                    result = predict_latest(model)

                    if result is not None:
                        last_timestamp = current_timestamp

                else:
                    print("Aucune nouvelle donnée.")

        except KeyboardInterrupt:
            print()
            print("✓ Surveillance arrêtée.")
            break

        except Exception as error:
            print(f"❌ Erreur : {error}")

        time.sleep(interval)


def main():

    try:
        check_configuration()

        print("========================================")
        print("     MISSION-SENTINEL-X")
        print("     MAINTENANCE PREDICTIVE")
        print("========================================")
        print()

        print("✓ Modèle chargé :")
        print(MODEL_PATH)
        print()

        print("✓ Source des données :")
        print("API SENTINEL-X")
        print("http://127.0.0.1:3000/api/v1/alerts")
        print()

        print("✓ Variables utilisées :")

        for feature in FEATURES:
            print(f"  - {feature}")

        print()

        model = joblib.load(MODEL_PATH)

        print("✓ Isolation Forest chargé")
        print()

        monitor(
            model,
            interval=5
        )

    except Exception as error:
        print()
        print(f"❌ Erreur au démarrage : {error}")


if __name__ == "__main__":
    main()