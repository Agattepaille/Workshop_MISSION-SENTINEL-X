import requests


API_URL = "http://127.0.0.1:3000/api/v1/alerts"


def get_latest_alert():
    """
    Récupère les alertes depuis l'API et retourne
    la donnée la plus récente.

    L'API peut retourner plusieurs alertes.
    La dernière est sélectionnée selon le timestamp.
    """

    response = requests.get(
        API_URL,
        params={"limit": 100},
        timeout=5,
    )

    response.raise_for_status()

    result = response.json()

    alerts = result.get("data", [])

    if not alerts:
        return None

    latest_alert = max(
        alerts,
        key=lambda alert: alert["timestamp"]
    )

    return latest_alert


def extract_measurements(alert):
    """
    Extrait uniquement les variables utilisées
    par le modèle Isolation Forest.
    """

    measurements = alert.get("measurements", {})

    return {
        "temperature_c": float(
            measurements["temperature_c"]
        ),
        "humidity_pct": float(
            measurements["humidity_pct"]
        ),
        "gas_raw": float(
            measurements["gas_raw"]
        ),
    }