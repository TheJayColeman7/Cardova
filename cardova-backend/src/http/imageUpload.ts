import Busboy from "busboy";
import type { IncomingMessage } from "node:http";
import type { Readable } from "node:stream";
import type { RecognitionImage } from "../domain/recognition.js";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

export type ImageUploadCode = "unsupported_type" | "image_too_large" | "invalid_upload";

export class ImageUploadError extends Error {
  readonly code: ImageUploadCode;

  constructor(code: ImageUploadCode, message: string) {
    super(message);
    this.name = "ImageUploadError";
    this.code = code;
  }
}

const MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

function isAllowedMime(value: string): value is RecognitionImage["mimeType"] {
  return (MIME_TYPES as readonly string[]).includes(value);
}

export function detectImageMime(bytes: Buffer): RecognitionImage["mimeType"] | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export function assertCardImage(bytes: Buffer, declaredMime: string, maxBytes = MAX_IMAGE_BYTES): RecognitionImage {
  if (bytes.length > maxBytes) {
    throw new ImageUploadError("image_too_large", "That image is larger than 10 MB.");
  }

  const mime = declaredMime.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!isAllowedMime(mime)) {
    throw new ImageUploadError("unsupported_type", "Use a JPEG, PNG, or WebP image.");
  }

  const detected = detectImageMime(bytes);
  if (detected !== mime) {
    throw new ImageUploadError("unsupported_type", "Use a JPEG, PNG, or WebP image.");
  }

  return { bytes, mimeType: mime };
}

interface CollectedFile {
  fieldName: string;
  bytes: Buffer;
  mimeType: string;
  truncated: boolean;
}

export function parseCardImage(req: IncomingMessage, maxBytes = MAX_IMAGE_BYTES): Promise<RecognitionImage> {
  const contentType = req.headers["content-type"] ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    req.resume();
    return Promise.reject(new ImageUploadError("invalid_upload", "Upload the image as multipart form data."));
  }

  const contentLength = Number(req.headers["content-length"] ?? 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes + MULTIPART_OVERHEAD_BYTES) {
    req.resume();
    return Promise.reject(new ImageUploadError("image_too_large", "That image is larger than 10 MB."));
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const files: CollectedFile[] = [];
    let uploadError: ImageUploadError | null = null;

    const fail = (error: ImageUploadError) => {
      uploadError = error;
    };

    let parser: ReturnType<typeof Busboy>;
    try {
      parser = Busboy({
        headers: req.headers,
        limits: { files: 2, fileSize: maxBytes, fields: 5 },
      });
    } catch {
      req.resume();
      reject(new ImageUploadError("invalid_upload", "That upload could not be read."));
      return;
    }

    parser.on("file", (name, stream: Readable & { truncated?: boolean }, info) => {
      const chunks: Buffer[] = [];
      let truncated = false;
      stream.on("data", (chunk: Buffer) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      stream.on("limit", () => {
        truncated = true;
      });
      stream.on("end", () => {
        files.push({
          fieldName: name,
          bytes: Buffer.concat(chunks),
          mimeType: info.mimeType,
          truncated: truncated || Boolean(stream.truncated),
        });
      });
    });

    parser.on("filesLimit", () => {
      fail(new ImageUploadError("invalid_upload", "Send exactly one image."));
    });

    parser.on("error", () => {
      fail(new ImageUploadError("invalid_upload", "That upload could not be read."));
    });

    parser.on("close", () => {
      if (settled) return;
      settled = true;
      if (uploadError) {
        reject(uploadError);
        return;
      }
      if (files.length !== 1 || files[0]?.fieldName !== "image") {
        reject(new ImageUploadError("invalid_upload", "Send exactly one image."));
        return;
      }
      const file = files[0];
      if (file.truncated) {
        reject(new ImageUploadError("image_too_large", "That image is larger than 10 MB."));
        return;
      }
      try {
        resolve(assertCardImage(file.bytes, file.mimeType, maxBytes));
      } catch (error) {
        reject(error);
      }
    });

    req.pipe(parser);
  });
}
