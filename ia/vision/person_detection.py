import cv2
import time
from ultralytics import YOLO

model = YOLO("yolov8n.pt")

camera = cv2.VideoCapture(1)

camera.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

if not camera.isOpened():
    print("❌ Webcam non détectée")
    exit()

print("✅ Webcam ouverte")
print("Appuyez sur Q pour quitter.")


person_frames = 0
presence_confirmed = False

CONFIDENCE_THRESHOLD = 0.50
FRAMES_REQUIRED = 5

total_frames = 0
total_processing_time = 0


while True:

    success, frame = camera.read()

    if not success:
        print("❌ Impossible de récupérer l'image")
        break

    total_frames += 1

    start_time = time.perf_counter()

    results = model(frame, verbose=False)


    person_detected = False
    best_confidence = 0.0

    for result in results:

        for box in result.boxes:

            class_id = int(box.cls[0])
            confidence = float(box.conf[0])

            # Classe 0 = personne
            if class_id == 0 and confidence >= CONFIDENCE_THRESHOLD:

                person_detected = True

                if confidence > best_confidence:
                    best_confidence = confidence


    processing_time = (
        time.perf_counter() - start_time
    ) * 1000

    total_processing_time += processing_time


    if person_detected:

        person_frames += 1

    else:

        person_frames = 0
        presence_confirmed = False


    # Une personne doit être détectée pendant plusieurs frames

    if person_frames >= FRAMES_REQUIRED:

        if not presence_confirmed:

            print(
                "🚨 PRÉSENCE HUMAINE CONFIRMÉE ! "
                f"Confiance : {best_confidence:.2f}"
            )

        presence_confirmed = True



    annotated_frame = results[0].plot()


    if processing_time > 0:

        fps = 1000 / processing_time

    else:

        fps = 0


    if presence_confirmed:

        status = "PRESENCE CONFIRMEE"

    elif person_detected:

        status = "PERSONNE DETECTEE"

    else:

        status = "AUCUNE PERSONNE"


    cv2.putText(
        annotated_frame,
        status,
        (20, 35),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (0, 0, 255) if person_detected else (0, 255, 0),
        2
    )


    # Confiance

    if person_detected:

        confidence_text = (
            f"Confiance : {best_confidence:.2f}"
        )

    else:

        confidence_text = "Confiance : --"


    cv2.putText(
        annotated_frame,
        confidence_text,
        (20, 70),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.6,
        (255, 255, 255),
        2
    )


    # Temps de traitement

    cv2.putText(
        annotated_frame,
        f"Temps IA : {processing_time:.1f} ms",
        (20, 100),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.6,
        (255, 255, 255),
        2
    )


    # FPS

    cv2.putText(
        annotated_frame,
        f"FPS : {fps:.1f}",
        (20, 130),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.6,
        (255, 255, 255),
        2
    )


    cv2.imshow(
        "SENTINEL-X - Detection IA",
        annotated_frame
    )


    if cv2.waitKey(1) & 0xFF == ord("q"):

        break


camera.release()
cv2.destroyAllWindows()


if total_frames > 0:

    average_time = (
        total_processing_time / total_frames
    )

    print("\n==============================")
    print("       STATISTIQUES")
    print("==============================")

    print(
        f"Nombre de frames : {total_frames}"
    )

    print(
        f"Temps moyen IA : {average_time:.2f} ms"
    )

    if average_time > 0:

        average_fps = 1000 / average_time

        print(
            f"FPS moyen : {average_fps:.2f}"
        )

    print("==============================")