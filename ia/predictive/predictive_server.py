from flask import Flask, request, jsonify
from flask_cors import CORS

from predict import predict_from_esp_json


app = Flask(__name__)
CORS(app)


@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "project": "MISSION-SENTINEL-X",
        "service": "Predictive Maintenance AI",
        "status": "running"
    })


@app.route("/api/predictive", methods=["POST"])
def predictive_analysis():

    try:
        # Récupération du JSON envoyé
        payload = request.get_json()

        if not payload:
            return jsonify({
                "status": "ERROR",
                "message": "Aucune donnée JSON reçue"
            }), 400

        # Analyse avec Isolation Forest
        result = predict_from_esp_json(payload)

        # Vérification des données
        if result["status"] == "INVALID_DATA":
            return jsonify(result), 400

        return jsonify(result), 200

    except Exception as e:
        return jsonify({
            "status": "ERROR",
            "message": str(e)
        }), 500


if __name__ == "__main__":

    print("========================================")
    print("   MISSION-SENTINEL-X")
    print("   Predictive Maintenance AI")
    print("========================================")
    print()
    print("API disponible sur :")
    print("http://127.0.0.1:5002")
    print()
    print("Endpoint prédictif :")
    print("POST /api/predictive")
    print()

    app.run(
        host="0.0.0.0",
        port=5002,
        debug=False
    )