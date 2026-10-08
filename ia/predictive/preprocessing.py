import pandas as pd


FEATURES = [
    "measurement_temperature_c",
    "measurement_humidity_pct",
    "measurement_gas_raw",
]


def load_data(csv_path):
    df = pd.read_csv(csv_path)

    print(f"Nombre total de lignes : {len(df)}")
    print(f"Colonnes : {df.columns.tolist()}")

    return df


def prepare_features(df):
    X = df[FEATURES].copy()

    for column in FEATURES:
        X[column] = pd.to_numeric(
            X[column],
            errors="coerce"
        )

    # Garder uniquement les lignes
    # où les 3 mesures sont disponibles
    X = X.dropna()

    return X