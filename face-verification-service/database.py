"""
Supabase access for face verification. Uses the same voters table as the Node backend.
Loads SUPABASE_URL and SUPABASE_KEY from .env (same values as backend/.env).
"""
import os
from pathlib import Path
from supabase import create_client, Client

# Load .env from this directory or project root
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent / ".env")
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:
    pass

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Set SUPABASE_URL and SUPABASE_KEY in environment (e.g. .env)")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def get_voter(voter_id: str) -> dict | None:
    """Fetch a voter by voter_id. Returns row with face_encoding and has_voted."""
    try:
        response = (
            supabase.table("voters")
            .select("voter_id, name, age, booth_no, face_encoding, has_voted")
            .eq("voter_id", voter_id)
            .execute()
        )
        if response.data and len(response.data) > 0:
            return response.data[0]
        return None
    except Exception as e:
        print(f"Supabase get_voter error: {e}")
        return None


def update_face_encoding(voter_id: str, face_encoding: list[float]) -> bool:
    """Store or update face encoding for an existing voter. Encoding is 128 floats."""
    try:
        supabase.table("voters").update({
            "face_encoding": face_encoding,
        }).eq("voter_id", voter_id).execute()
        return True
    except Exception as e:
        print(f"Supabase update_face_encoding error: {e}")
        return False
