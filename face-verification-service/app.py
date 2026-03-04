"""
Face Verification Service for SecureVoting.
Handles face encoding, liveness checks, and verification against Supabase voters table.
"""
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from services.face_logic import encode_face, verify_face_match_with_challenge
from database import get_voter, update_face_encoding
import cv2
import numpy as np

app = FastAPI(title="SecureVoting Face Verification", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def health():
    return {"service": "face-verification", "status": "ok"}


@app.post("/verify")
async def verify_user(
    voter_id: str = Form(...),
    challenge_type: str = Form("smile"),
    file: UploadFile = File(...),
):
    """
    Verify a voter's face against stored encoding (1:1 match + liveness challenge).
    Used by the main frontend after voter lookup.
    """
    user_data = get_voter(voter_id)
    if not user_data:
        raise HTTPException(status_code=404, detail="Invalid Voter ID")

    face_encoding = user_data.get("face_encoding")
    if not face_encoding:
        raise HTTPException(
            status_code=400,
            detail="No face registered for this voter. Complete registration first.",
        )

    if user_data.get("has_voted"):
        raise HTTPException(status_code=403, detail="This voter has already voted.")

    image_data = await file.read()
    nparr = np.frombuffer(image_data, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image file.")

    is_match, message = verify_face_match_with_challenge(
        face_encoding, img, challenge_type
    )

    if is_match:
        return {
            "verified": True,
            "message": message,
        }
    raise HTTPException(status_code=401, detail=message)


@app.post("/register-face")
async def register_face(
    voter_id: str = Form(...),
    file: UploadFile = File(...),
):
    """
    Register or update face encoding for an existing voter (by voter_id).
    Call after the voter exists in Supabase (voter_id, name, age, booth_no).
    """
    user_data = get_voter(voter_id)
    if not user_data:
        raise HTTPException(status_code=404, detail="Voter not found. Add voter first.")

    image_data = await file.read()
    nparr = np.frombuffer(image_data, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image file.")

    encoding = encode_face(img)
    if not encoding:
        raise HTTPException(status_code=400, detail="No face detected in image.")

    ok = update_face_encoding(voter_id, encoding)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to save face encoding.")

    return {"status": "success", "message": f"Face registered for voter {voter_id}."}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
