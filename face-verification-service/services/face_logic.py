"""
Face encoding and liveness verification using face_recognition and landmarks.
"""
import face_recognition
import numpy as np
import cv2
from scipy.spatial import distance as dist


def encode_face(image_nparray):
    rgb_img = cv2.cvtColor(image_nparray, cv2.COLOR_BGR2RGB)
    encodings = face_recognition.face_encodings(rgb_img)
    if len(encodings) > 0:
        return encodings[0].tolist()
    return None


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
    known_encoding, live_image_nparray, challenge_type="smile"
):
    rgb_img = cv2.cvtColor(live_image_nparray, cv2.COLOR_BGR2RGB)
    landmarks_list = face_recognition.face_landmarks(rgb_img)

    if not landmarks_list:
        return False, "No face detected. (Ensure face is not covered)"

    if challenge_type != "none":
        is_live, live_msg = check_expression(landmarks_list[0], challenge_type)
        if not is_live:
            return False, f"Liveness Failed: {live_msg}"

    live_encoding = encode_face(live_image_nparray)
    if live_encoding is None:
        return False, "Face encoding failed."

    results = face_recognition.compare_faces(
        [np.array(known_encoding)], np.array(live_encoding), tolerance=0.5
    )

    if results[0]:
        return True, "Verified Successfully"
    return False, "Face ID does not match registered user."
