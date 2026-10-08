from pathlib import Path

import joblib
from sklearn.ensemble import IsolationForest

from preprocessing import load_data, prepare_features


BASE_DIR = Path(__file__).resolve().parent

DATA_PATH = BASE_DIR / "alerts.csv"

MODEL_DIR = BASE_DIR / "models"
MODEL_PATH = MODEL_DIR / "isolation_forest_final.joblib"


def train_model():

    print("=== MISSION-SENTINEL-X ===")
    print("=== Entraînement Isolation Forest ===\n")

    # 1. Charger alerts.csv
    df = load_data(DATA_PATH)

    # 2. Préparer les 3 variables
    X = prepare_features(df)

    print(f"\nNombre de données utilisables : {len(X)}")

    print("\nVariables utilisées :")
    for feature in X.columns:
        print(f"- {feature}")

    # 3. Vérification
    print("\nPremières données utilisées :")
    print(X.head())

    # 4. Création du modèle
    model = IsolationForest(
        n_estimators=300,
        contamination=0.02,
        random_state=42,
    )

    print("\nEntraînement du modèle...")

    model.fit(X)

    # 5. Création du dossier models
    MODEL_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    # 6. Sauvegarde
    joblib.dump(
        model,
        MODEL_PATH
    )

    print("\n✓ Modèle entraîné avec succès")
    print(f"✓ Modèle sauvegardé : {MODEL_PATH}")


if __name__ == "__main__":
    train_model()