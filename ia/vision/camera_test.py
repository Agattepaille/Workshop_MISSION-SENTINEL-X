import cv2

camera = cv2.VideoCapture(1)

if not camera.isOpened():
    print("❌ Webcam non détectée")
    exit()

print("✅ Webcam détectée !")
print("Appuyez sur Q pour quitter.")

while True:
    success, frame = camera.read()

    if not success:
        print("❌ Impossible de récupérer l'image")
        break

    cv2.imshow("SENTINEL-X - Webcam", frame)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

camera.release()
cv2.destroyAllWindows()