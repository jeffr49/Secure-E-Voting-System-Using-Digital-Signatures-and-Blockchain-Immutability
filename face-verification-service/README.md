# Face Verification Service

Standalone Python service for SecureVoting. Verifies voter identity using face encoding and liveness challenges. Uses the same Supabase `voters` table as the Node backend.

## Endpoints

- **POST /verify** — Verify voter by `voter_id` + image file + `challenge_type` (smile, wink, angry, surprise). Used by the frontend after voter lookup.
- **POST /register-face** — Register or update face encoding for an existing voter (admin/setup).

## Setup

1. Create a virtualenv and install deps:
   ```bash
   cd face-verification-service
   python -m venv .venv
   .venv\Scripts\activate   # Windows
   pip install -r requirements.txt
   ```
2. Copy `.env.example` to `.env` and set `SUPABASE_URL` and `SUPABASE_KEY` (same values as in `backend/.env`).
3. Run:
   ```bash
   uvicorn app:app --host 0.0.0.0 --port 8000 --reload
   ```

Frontend and backend expect this service at `http://localhost:8000`.
