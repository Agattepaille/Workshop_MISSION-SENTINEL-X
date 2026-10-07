from pathlib import Path
import joblib
import pandas as pd

from preprocessing import FEATURES


# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "models" / "isolation_forest.joblib"


# ============================================================
# CHARGEMENT DU MODÈLE
# ============================================================

model = joblib.load(MODEL_PATH)


# ============================================================
# PRÉDICTION À PARTIR DES FEATURES
# ============================================================

def predict_anomaly(
    temperature_c,
    humidity_pct,
    gas_raw,
    motion,
    distance_cm
):
    """
    Analyse une mesure capteur avec Isolation Forest.
    """

    data = pd.DataFrame([{
        "temperature_c": temperature_c,
        "humidity_pct": humidity_pct,
        "gas_raw": gas_raw,
        "motion": motion,
        "distance_cm": distance_cm
    }])

    # Vérification des données
    if data.isnull().any().any():
        return "INVALID_DATA", None

    # Prédiction
    prediction = model.predict(data)[0]

    # Score d'anomalie
    score = model.decision_function(data)[0]

    if prediction == -1:
        status = "ANOMALIE"
    else:
        status = "NORMAL"

    return status, float(score)


# ============================================================
# PRÉDICTION À PARTIR DU JSON ESP8266
# ============================================================

def predict_from_esp_json(payload):
    """
    Transforme le JSON de l'ESP8266 en variables
    utilisables par le modèle Isolation Forest.
    """

    try:
        dht22 = payload.get("dht22", {})
        mq2 = payload.get("mq2", {})
        pir = payload.get("pir", {})
        hcsr04 = payload.get("hcsr04", {})

        temperature_c = dht22.get("temperature")
        humidity_pct = dht22.get("humidity")
        gas_raw = mq2.get("gasRaw")
        motion = int(bool(pir.get("motion")))
        distance_cm = hcsr04.get("distanceCm")

        status, score = predict_anomaly(
            temperature_c=temperature_c,
            humidity_pct=humidity_pct,
            gas_raw=gas_raw,
            motion=motion,
            distance_cm=distance_cm
        )

        return {
            "status": status,
            "score": score,
            "features": {
                "temperature_c": temperature_c,
                "humidity_pct": humidity_pct,
                "gas_raw": gas_raw,
                "motion": motion,
                "distance_cm": distance_cm
            }
        }

    except Exception as e:
        return {
            "status": "ERROR",
            "score": None,
            "error": str(e)
        }


# ============================================================
# TEST
# ============================================================

if __name__ == "__main__":

    print("=== MISSION-SENTINEL-X ===")
    print("=== Test prédiction ESP8266 ===\n")

    # Exemple correspondant au JSON réel de l'ESP8266
    esp_data = {
        "dht22": {
            "temperature": 24.5,
            "humidity": 50.0
        },
        "mq2": {
            "gasRaw": 19.0
        },
        "pir": {
            "motion": False
        },
        "hcsr04": {
            "distanceCm": 25.0
        }
    }

    result = predict_from_esp_json(esp_data)

    print("Données ESP8266 :")
    print(esp_data)

    print("\nRésultat IA :")
    print(f"Statut : {result['status']}")
    print(f"Score : {result['score']}")