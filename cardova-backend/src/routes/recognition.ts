import { Router } from "express";
import type { RecognitionImage, RecognitionResult } from "../domain/recognition.js";
import { ImageUploadError } from "../http/imageUpload.js";
import { parseCardImage } from "../http/imageUpload.js";
import { RecognitionError } from "../recognition/recognitionError.js";

const UPLOAD_STATUS: Record<ImageUploadError["code"], number> = {
  unsupported_type: 415,
  image_too_large: 413,
  invalid_upload: 400,
};

const RECOGNITION_STATUS: Record<RecognitionError["code"], number> = {
  provider_unavailable: 503,
  recognition_timeout: 504,
  provider_response: 502,
};

export function createRecognitionRouter(
  recognize: (image: RecognitionImage) => Promise<RecognitionResult>
) {
  const router = Router();

  router.post("/cards", async (req, res) => {
    try {
      const image = await parseCardImage(req);
      const result = await recognize(image);
      res.json(result);
    } catch (error) {
      if (error instanceof ImageUploadError) {
        res.status(UPLOAD_STATUS[error.code]).json({ error: error.code, message: error.message });
        return;
      }
      if (error instanceof RecognitionError) {
        res.status(RECOGNITION_STATUS[error.code]).json({ error: error.code, message: error.message });
        return;
      }
      console.error("Recognition failed:", error instanceof Error ? error.message : "unknown");
      res.status(500).json({ error: "recognition_failed", message: "Card recognition failed." });
    }
  });

  return router;
}
