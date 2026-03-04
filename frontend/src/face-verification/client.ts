/**
 * Face verification client. Calls the face-verification-service (Python) at port 8000.
 */
const FACE_VERIFY_URL = process.env.NEXT_PUBLIC_FACE_VERIFY_URL ?? "http://localhost:8000";

export async function verifyFace(
  voterId: string,
  imageFile: File,
  challengeType: string = "smile"
): Promise<boolean> {
  try {
    const formData = new FormData();
    formData.append("voter_id", voterId);
    formData.append("challenge_type", challengeType);
    formData.append("file", imageFile);

    const response = await fetch(`${FACE_VERIFY_URL}/verify`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error("Face verification failed:", response.status, err);
      return false;
    }

    const data = await response.json();
    return Boolean(data?.verified);
  } catch (error) {
    console.error("Error during face verification:", error);
    return false;
  }
}
