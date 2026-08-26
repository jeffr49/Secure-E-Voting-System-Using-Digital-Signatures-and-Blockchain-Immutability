"""
Face encoding and liveness verification using face_recognition and landmarks.
Refactored to handle mobile camera EXIF rotation and image scaling.
"""
import numpy as np
import cv2
from scipy.spatial import distance as dist
from PIL import Image, ImageOps
import io

try:
    import face_recognition  # type: ignore[import-not-found]
except ModuleNotFoundError:
    face_recognition = None

def decode_image_bytes(image_bytes: bytes):
    """
    Decodes raw bytes into a numpy RGB array while correcting EXIF orientation
    and scaling down massive 4K phone camera pictures.
    """
    if not image_bytes:
        return None
    try:
        pil_img = Image.open(io.BytesIO(image_bytes))
        pil_img = ImageOps.exif_transpose(pil_img)
        if pil_img.mode != "RGB":
            pil_img = pil_img.convert("RGB")
        
        rgb_img = np.array(pil_img)
        
        h, w = rgb_img.shape[:2]
        if max(h, w) > 1200:
            scale = 1200.0 / max(h, w)
            rgb_img = cv2.resize(rgb_img, (0,0), fx=scale, fy=scale)
            
        return rgb_img
    except Exception as e:
        print(f"DEBUG Image decoding failed: {e}")
        return None

def encode_face(image_bytes: bytes):
    rgb_img = decode_image_bytes(image_bytes)
    if rgb_img is None:
        return None

    if face_recognition is not None:
        encodings = face_recognition.face_encodings(rgb_img)
        if encodings:
            return encodings[0].tolist()
        return None

    return encode_face_with_opencv(rgb_img)


def encode_face_with_opencv(rgb_img):
    gray = cv2.cvtColor(rgb_img, cv2.COLOR_RGB2GRAY)
    cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    detector = cv2.CascadeClassifier(cascade_path)
    faces = detector.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(80, 80))

    if len(faces) == 0:
        return None

    x, y, w, h = max(faces, key=lambda face: face[2] * face[3])
    face = gray[y:y + h, x:x + w]
    face = cv2.resize(face, (32, 32), interpolation=cv2.INTER_AREA)
    face = cv2.equalizeHist(face)
    encoding = face.astype(np.float32).flatten() / 255.0
    return encoding.tolist()


def compare_opencv_encodings(known_encoding, live_encoding):
    known = np.array(known_encoding, dtype=np.float32)
    live = np.array(live_encoding, dtype=np.float32)

    if known.shape != live.shape or known.size == 0:
        return False

    distance = np.linalg.norm(known - live) / np.sqrt(known.size)
    return distance < 0.35

def get_ear(eye_points):
    A = dist.euclidean(eye_points[1], eye_points[5])
    B = dist.euclidean(eye_points[2], eye_points[4])
    C = dist.euclidean(eye_points[0], eye_points[3])
    return (A + B) / (2.0 * C)

def get_mar(mouth_points):
    A = dist.euclidean(mouth_points[3], mouth_points[9])
    B = dist.euclidean(mouth_points[0], mouth_points[6])
    return A / B

def check_expression(landmarks, challenge_type):
    left_eye = landmarks["left_eye"]
    right_eye = landmarks["right_eye"]
    top_lip = landmarks["top_lip"]
    bottom_lip = landmarks["bottom_lip"]
    left_eyebrow = landmarks["left_eyebrow"]
    right_eyebrow = landmarks["right_eyebrow"]

    left_ear = get_ear(left_eye)
    right_ear = get_ear(right_eye)

    if challenge_type == "smile":
        mouth_width = dist.euclidean(top_lip[0], top_lip[6])
        mouth_height = dist.euclidean(top_lip[3], bottom_lip[3])
        if mouth_width > (mouth_height * 2.0):
            return True, "Smile Detected"
        return False, "Smile Wider (Show Teeth)"

    if challenge_type == "angry":
        brow_dist = dist.euclidean(left_eyebrow[-1], right_eyebrow[0])
        eye_width = dist.euclidean(left_eye[0], left_eye[3])
        if brow_dist < eye_width:
            return True, "Anger Detected"
        return False, "Frown Harder (Pinch Eyebrows)"

    if challenge_type == "surprise":
        mouth_height = dist.euclidean(top_lip[3], bottom_lip[3])
        mouth_width = dist.euclidean(top_lip[0], top_lip[6])
        if mouth_height > (mouth_width * 0.5):
            return True, "Surprise/Open Mouth Detected"
        return False, "Open Mouth Wider (Say 'O')"

    if challenge_type == "wink":
        diff = abs(left_ear - right_ear)
        if diff > 0.04:
            return True, "Wink Detected"
        return False, "Wink Harder (Close one eye tight)"

    return True, "Challenge Passed"

def verify_face_match_with_challenge(
    known_encoding, image_bytes: bytes, challenge_type="smile"
):
    rgb_img = decode_image_bytes(image_bytes)
    if rgb_img is None:
        return False, "Invalid image data."

    if face_recognition is None:
        live_encoding = encode_face_with_opencv(rgb_img)
        if live_encoding is None:
            return False, "No face detected. Ensure your face is well-lit and upright."

        if compare_opencv_encodings(known_encoding, live_encoding):
            return True, "Verified Successfully"
        return False, "Face ID does not match registered user."

    landmarks_list = face_recognition.face_landmarks(rgb_img)

    if not landmarks_list:
        return False, "No face detected. (Ensure your face is well-lit and upright)"

    if challenge_type != "none":
        is_live, live_msg = check_expression(landmarks_list[0], challenge_type)
        if not is_live:
            return False, f"Liveness Failed: {live_msg}"

    live_encodings = face_recognition.face_encodings(rgb_img)
    if not live_encodings:
        return False, "Face encoding failed."

    live_encoding = live_encodings[0]

    results = face_recognition.compare_faces(
        [np.array(known_encoding)], live_encoding, tolerance=0.6
    )

    if results[0]:
        return True, "Verified Successfully"
    return False, "Face ID does not match registered user."
