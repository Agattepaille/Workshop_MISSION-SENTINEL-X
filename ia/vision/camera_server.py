import cv2
from flask import Flask, Response, jsonify
from flask_cors import CORS
from ultralytics import YOLO

app = Flask(__name__)
CORS(app)

# Modèle YOLO
model = YOLO("ia/vision/yolov8n.pt")

# Webcam
camera = cv2.VideoCapture(0)

# Dernières détections
latest_detections = []


def generate_frames():

    global latest_detections

    while True:

        success, frame = camera.read()

        if not success:
            print("Erreur : impossible de lire la webcam")
            break

        # Détection YOLO
        results = model(frame, verbose=False)

        # Réinitialiser les détections de l'image actuelle
        current_detections = []

        for result in results:

            for box in result.boxes:

                class_id = int(box.cls[0])
                confidence = float(box.conf[0])

                # Classe 0 = personne
                if class_id == 0:

                    x1, y1, x2, y2 = map(
                        int,
                        box.xyxy[0]
                    )

                    # Ajouter la détection pour l'API
                    current_detections.append({
                        "class": "person",
                        "confidence": round(confidence, 2),
                        "bbox": {
                            "x1": x1,
                            "y1": y1,
                            "x2": x2,
                            "y2": y2
                        }
                    })

                    # Dessiner le rectangle
                    cv2.rectangle(
                        frame,
                        (x1, y1),
                        (x2, y2),
                        (0, 255, 0),
                        2
                    )

                    # Texte
                    label = f"Person {confidence:.2f}"

                    cv2.putText(
                        frame,
                        label,
                        (x1, y1 - 10),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.7,
                        (0, 255, 0),
                        2
                    )

        # Sauvegarder les dernières détections
        latest_detections = current_detections

        # Conversion JPEG
        success, buffer = cv2.imencode(".jpg", frame)

        if not success:
            continue

        frame_bytes = buffer.tobytes()

        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n"
            + frame_bytes
            + b"\r\n"
        )


@app.route("/")
def home():

    return {
        "project": "SENTINEL-X",
        "service": "AI Vision",
        "status": "running"
    }


@app.route("/video")
def video():

    return Response(
        generate_frames(),
        mimetype="multipart/x-mixed-replace; boundary=frame"
    )


@app.route("/detections")
def detections():

    return jsonify({
        "count": len(latest_detections),
        "detections": latest_detections
    })


if __name__ == "__main__":

    print("================================")
    print(" SENTINEL-X - AI VISION")
    print("================================")
    print("Camera : OK")
    print("Server : http://127.0.0.1:5001")
    print("Video  : http://127.0.0.1:5001/video")
    print("API    : http://127.0.0.1:5001/detections")

    app.run(
        host="0.0.0.0",
        port=5001,
        debug=False
    )