export type RecognitionErrorCode = "provider_unavailable" | "recognition_timeout" | "provider_response";

export class RecognitionError extends Error {
  readonly code: RecognitionErrorCode;

  constructor(code: RecognitionErrorCode, message: string) {
    super(message);
    this.name = "RecognitionError";
    this.code = code;
  }
}

export function toRecognitionError(error: unknown): RecognitionError {
  if (error instanceof RecognitionError) return error;

  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return new RecognitionError("recognition_timeout", "Card recognition timed out.");
  }

  const status = readStatus(error);
  if (status === 408 || status === 504) {
    return new RecognitionError("recognition_timeout", "Card recognition timed out.");
  }

  return new RecognitionError("provider_unavailable", "Card recognition is unavailable.");
}

function readStatus(error: unknown): number | null {
  if (!error || typeof error !== "object" || !("status" in error)) return null;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
}
