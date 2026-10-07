from pathlib import Path

import joblib
from sklearn.ensemble import IsolationForest

from preprocessing import load_data, prepare_features


# ============================================================
# CHEMINS DU PROJET
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

DATA_PATH = BASE_DIR / "sentinel_x_esp8266_normal_data.csv"

MODEL_DIR = BASE_DIR / "models"
MODEL_PATH = MODEL_DIR / "isolation_forest.joblib"


# ============================================================
# ENTRAÎNEMENT
# ============================================================

def train_model():

    print("=== MISSION-SENTINEL-X ===")
    print("=== Entraînement Isolation Forest ===\n")

    # Chargement des données
    df = load_data(DATA_PATH)

    # Préparation des variables
    X = prepare_features(df)

    print(f"\nNombre de données utilisées : {len(X)}")

    print("\nVariables utilisées :")
    print(X.columns.tolist())

    # Création du modèle
    model = IsolationForest(
        n_estimators=200,
        contamination="auto",
        random_state=42
    )

    # Entraînement
    print("\nEntraînement du modèle...")

    model.fit(X)

    # Création du dossier models
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    # Sauvegarde
    joblib.dump(model, MODEL_PATH)

    print("\n✓ Modèle entraîné avec succès")
    print(f"✓ Modèle sauvegardé ici : {MODEL_PATH}")


# ============================================================
# PROGRAMME PRINCIPAL
# ============================================================

if __name__ == "__main__":
    train_model()