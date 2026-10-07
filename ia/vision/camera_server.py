import time
import cv2
from flask import Flask, Response, jsonify
from flask_cors import CORS
from ultralytics import YOLO

app = Flask(__name__)
CORS(app)

# ============================================================
# CONFIGURATION
# ============================================================

AI_SERVER_HOST = "0.0.0.0"
AI_SERVER_PORT = 5001

CAMERA_ID = 0

FRAME_WIDTH = 640
FRAME_HEIGHT = 480

CONFIDENCE_THRESHOLD = 0.4

MODEL_PATH = "ia/vision/yolov8n.pt"

# ============================================================
# INITIALISATION
# ============================================================

print("Chargement du modèle YOLO...")

model = YOLO(MODEL_PATH)

print("Modèle YOLO chargé.")

camera = cv2.VideoCapture(CAMERA_ID)

camera.set(cv2.CAP_PROP_FRAME_WIDTH, FRAME_WIDTH)
camera.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_HEIGHT)

if not camera.isOpened():
    print("ERREUR : impossible d'ouvrir la webcam")
else:
    print("Webcam ouverte.")

# Dernières informations disponibles
latest_detections = []
latest_latency_ms = 0.0
latest_fps = 0.0

# ============================================================
# DETECTION
# ============================================================


def process_frame(frame):
    """
    Effectue la détection YOLO sur une image 640x480.
    Retourne l'image annotée, les détections et la latence.
    """

    global latest_detections

    # --------------------------------------------------------
    # Redimensionnement systématique
    # --------------------------------------------------------

    frame = cv2.resize(
        frame,
        (FRAME_WIDTH, FRAME_HEIGHT),
        interpolation=cv2.INTER_LINEAR
    )

    # --------------------------------------------------------
    # Mesure du temps de traitement
    # --------------------------------------------------------

    start_time = time.perf_counter()

    results = model(
        frame,
        verbose=False,
        conf=CONFIDENCE_THRESHOLD,
        imgsz=320
    )

    end_time = time.perf_counter()

    latency_ms = (end_time - start_time) * 1000

    # --------------------------------------------------------
    # Détections
    # --------------------------------------------------------

    current_detections = []

    for result in results:

        if result.boxes is None:
            continue

        for box in result.boxes:

            class_id = int(box.cls[0])
            confidence = float(box.conf[0])

            # Classe 0 = personne dans COCO
            if class_id != 0:
                continue

            x1, y1, x2, y2 = map(
                int,
                box.xyxy[0]
            )

            current_detections.append({
                "class": "person",
                "confidence": round(confidence, 3),
                "bbox": {
                    "x1": x1,
                    "y1": y1,
                    "x2": x2,
                    "y2": y2
                }
            })

            # ------------------------------------------------
            # Bounding box
            # ------------------------------------------------

            cv2.rectangle(
                frame,
                (x1, y1),
                (x2, y2),
                (0, 255, 0),
                2
            )

            # ------------------------------------------------
            # Label
            # ------------------------------------------------

            label = f"PERSON {confidence * 100:.0f}%"

            cv2.putText(
                frame,
                label,
                (x1, max(y1 - 10, 20)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (0, 255, 0),
                2
            )

    latest_detections = current_detections

    return frame, current_detections, latency_ms


# ============================================================
# VIDEO STREAM
# ============================================================


def generate_frames():

    global latest_latency_ms
    global latest_fps

    while True:

        success, frame = camera.read()

        if not success:
            print("Erreur : impossible de lire la webcam")
            break

        # ----------------------------------------------------
        # Traitement IA
        # ----------------------------------------------------

        processed_frame, detections, latency_ms = process_frame(frame)

        latest_latency_ms = round(latency_ms, 2)

        # FPS approximatif basé sur le traitement IA
        if latency_ms > 0:
            latest_fps = round(1000 / latency_ms, 1)

        # ----------------------------------------------------
        # Statut performance
        # ----------------------------------------------------

        if latency_ms < 100:
            performance_text = f"AI OK | {latency_ms:.0f} ms"
            performance_color = (0, 255, 0)
        else:
            performance_text = f"AI SLOW | {latency_ms:.0f} ms"
            performance_color = (0, 165, 255)

        # ----------------------------------------------------
        # Informations sur la vidéo
        # ----------------------------------------------------

        cv2.putText(
            processed_frame,
            performance_text,
            (10, 25),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.65,
            performance_color,
            2
        )

        cv2.putText(
            processed_frame,
            f"640x480 | Persons: {len(detections)}",
            (10, 50),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (255, 255, 255),
            1
        )

        # ----------------------------------------------------
        # Encodage JPEG
        # ----------------------------------------------------

        success, buffer = cv2.imencode(
            ".jpg",
            processed_frame,
            [cv2.IMWRITE_JPEG_QUALITY, 80]
        )

        if not success:
            continue

        frame_bytes = buffer.tobytes()

        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n"
            + frame_bytes
            + b"\r\n"
        )


# ============================================================
# API
# ============================================================


@app.route("/")
def home():

    return jsonify({
        "project": "SENTINEL-X",
        "service": "AI Vision",
        "status": "running",
        "camera": "connected" if camera.isOpened() else "disconnected",
        "resolution": f"{FRAME_WIDTH}x{FRAME_HEIGHT}",
        "model": "YOLOv8n"
    })


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
        "detections": latest_detections,
        "latency_ms": latest_latency_ms,
        "fps": latest_fps,
        "resolution": {
            "width": FRAME_WIDTH,
            "height": FRAME_HEIGHT
        },
        "performance": (
            "OK"
            if latest_latency_ms < 100
            else "SLOW"
        )
    })


# ============================================================
# START SERVER
# ============================================================


if __name__ == "__main__":

    print()
    print("================================")
    print(" SENTINEL-X - AI VISION")
    print("================================")
    print(f"Camera      : {'OK' if camera.isOpened() else 'ERROR'}")
    print(f"Resolution  : {FRAME_WIDTH}x{FRAME_HEIGHT}")
    print("Model       : YOLOv8n")
    print("Target      : < 100 ms")
    print("Server      : http://127.0.0.1:5001")
    print("Video       : http://127.0.0.1:5001/video")
    print("Detections  : http://127.0.0.1:5001/detections")
    print("================================")
    print()

    app.run(
        host=AI_SERVER_HOST,
        port=AI_SERVER_PORT,
        debug=False,
        threaded=True
    )