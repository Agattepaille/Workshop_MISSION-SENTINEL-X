import pandas as pd

SENSOR_COLUMNS = [
    "temperature_c",
    "humidity_pct",
    "pressure_hpa",
    "vibration_g",
    "gas_ppm",
    "current_a",
    "voltage_v",
    "rpm",
]


def build_baseline(df):
    baseline = {}

    for column in SENSOR_COLUMNS:
        baseline[column] = {
            "mean": df[column].mean(),
            "std": df[column].std(),
            "min": df[column].min(),
            "max": df[column].max(),
        }

    return baseline


if __name__ == "__main__":

    df = pd.read_csv("ia/predictive/sentinel_x_sensor_data.csv")

    # Pour l'instant, on considère les données disponibles
    # comme données normales de démonstration.
    baseline = build_baseline(df)

    for sensor, values in baseline.items():
        print(f"\n{sensor}")
        print(f"  moyenne : {values['mean']:.3f}")
        print(f"  écart-type : {values['std']:.3f}")
        print(f"  min : {values['min']:.3f}")
        print(f"  max : {values['max']:.3f}")