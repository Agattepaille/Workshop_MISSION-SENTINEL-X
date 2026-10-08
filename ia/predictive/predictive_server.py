from flask import Flask, jsonify
from flask_cors import CORS

import joblib

from predict import (
    check_configuration,
    predict_latest,
    MODEL_PATH,
)


app = Flask(__name__)
CORS(app)


# Chargement du modèle au démarrage
try:
    check_configuration()

    model = joblib.load(MODEL_PATH)

    print("✓ Modèle Isolation Forest chargé")
    print(f"✓ Modèle : {MODEL_PATH}")

except Exception as error:
    model = None

    print(
        f"❌ Erreur lors du chargement du modèle : {error}"
    )


@app.route("/", methods=["GET"])
def home():

    return jsonify({
        "project": "MISSION-SENTINEL-X",
        "service": "Predictive Maintenance AI",
        "status": "running",
    })


@app.route("/api/predictive", methods=["GET"])
def predictive():

    if model is None:

        return jsonify({
            "status": "ERROR",
            "message": "Modèle IA non chargé",
        }), 500

    try:

        result = predict_latest(model)

        if result is None:

            return jsonify({
                "status": "NO_DATA",
                "message": (
                    "Aucune donnée disponible "
                    "depuis l'API SENTINEL-X"
                ),
            }), 404

        return jsonify(result)

    except Exception as error:

        return jsonify({
            "status": "ERROR",
            "message": str(error),
        }), 500


if __name__ == "__main__":

    print()
    print("========================================")
    print("     MISSION-SENTINEL-X")
    print("     PREDICTIVE AI SERVER")
    print("========================================")
    print()
    print("✓ Serveur : http://127.0.0.1:5002")
    print("✓ Endpoint : /api/predictive")
    print("✓ Source : API SENTINEL-X")
    print("✓ API source : http://127.0.0.1:3000")
    print()

    app.run(
        host="0.0.0.0",
        port=5002,
        debug=False,
    )