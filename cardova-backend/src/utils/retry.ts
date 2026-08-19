import { HttpStatusError } from "./httpStatusError.js";
import { sleep } from "./sleep.js";

const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const RETRYABLE_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
]);

function isRetryable(error: unknown): boolean {
  if (error instanceof HttpStatusError) {
    return RETRYABLE_STATUS.has(error.status);
  }

  if (error instanceof TypeError) {
    return true;
  }

  if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
    return true;
  }

  if (error instanceof Error && "code" in error) {
    return RETRYABLE_CODES.has(String((error as NodeJS.ErrnoException).code));
  }

  return false;
}

function delayForAttempt(error: unknown, attempt: number): number {
  if (error instanceof HttpStatusError && error.retryAfterMs != null) {
    return Math.min(error.retryAfterMs, MAX_DELAY_MS);
  }

  const backoff = BASE_DELAY_MS * 2 ** (attempt - 1);
  return Math.min(backoff, MAX_DELAY_MS);
}

export async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isRetryable(error) || attempt === MAX_ATTEMPTS) {
        throw error;
      }

      const delayMs = delayForAttempt(error, attempt);
      console.warn(
        `Retryable error (attempt ${attempt}/${MAX_ATTEMPTS}), waiting ${delayMs}ms...`
      );
      await sleep(delayMs);
    }
  }

  throw lastError;
}
