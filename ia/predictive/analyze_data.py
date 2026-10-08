import pandas as pd

# Charger le fichier CSV
df = pd.read_csv("ai/predictive/sentinel_x_sensor_data.csv")

# Afficher les premières lignes
print("===== PREMIÈRES DONNÉES =====")
print(df.head())

# Dimensions du fichier
print("\n===== DIMENSIONS =====")
print(df.shape)

# Informations sur les colonnes
print("\n===== INFORMATIONS =====")
print(df.info())

# Statistiques
print("\n===== STATISTIQUES =====")
print(df.describe())

# Vérifier les valeurs manquantes
print("\n===== VALEURS MANQUANTES =====")
print(df.isnull().sum())