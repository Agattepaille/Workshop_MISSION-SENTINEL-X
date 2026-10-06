import cv2
from ultralytics import YOLO

# Charger le modèle
model = YOLO("yolov8n.pt")

# Ouvrir la webcam USB
camera = cv2.VideoCapture(1)

if not camera.isOpened():
    print("❌ Webcam non détectée")
    exit()

print("✅ Webcam ouverte")
print("Appuyez sur Q pour quitter.")

while True:

    success, frame = camera.read()

    if not success:
        print("❌ Impossible de récupérer l'image")
        break

    # Détection IA
    results = model(frame, verbose=False)

    # Afficher les résultats
    annotated_frame = results[0].plot()

    cv2.imshow("SENTINEL-X - Detection IA", annotated_frame)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

camera.release()
cv2.destroyAllWindows()