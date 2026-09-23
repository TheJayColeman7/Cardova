import type { CardRecognitionProvider, RecognitionImage } from "../../domain/recognition.js";
import { getScrydexCredentials } from "../../config/env.js";
import { RecognitionError, toRecognitionError } from "../../recognition/recognitionError.js";
import { mapScrydexVisionResponse } from "./mapScrydexVision.js";

const IDENTIFY_URL = "https://api.scrydex.com/vision/v1/cards/identify";
const TIMEOUT_MS = 20_000;

export interface ScrydexCredentials {
  apiKey: string;
  teamId: string;
}

export type ScrydexPoster = (input: RecognitionImage & ScrydexCredentials) => Promise<unknown>;

const FILE_NAMES: Record<RecognitionImage["mimeType"], string> = {
  "image/jpeg": "card.jpg",
  "image/png": "card.png",
  "image/webp": "card.webp",
};

export async function postScrydexVision(input: RecognitionImage & ScrydexCredentials): Promise<unknown> {
  const form = new FormData();
  const copy = Uint8Array.from(input.bytes);
  form.append("image", new Blob([copy], { type: input.mimeType }), FILE_NAMES[input.mimeType]);
  form.append("games", "pokemon");

  let response: Response;
  try {
    response = await fetch(IDENTIFY_URL, {
      method: "POST",
      headers: {
        "X-Api-Key": input.apiKey,
        "X-Team-ID": input.teamId,
      },
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw toRecognitionError(error);
  }

  if (!response.ok) {
    throw toRecognitionError({ status: response.status });
  }

  try {
    return await response.json();
  } catch {
    throw new RecognitionError("provider_response", "Recognition returned an unexpected response.");
  }
}

export function createScrydexVisionProvider(options?: {
  post?: ScrydexPoster;
  getCredentials?: () => ScrydexCredentials | null;
}): CardRecognitionProvider {
  const post = options?.post ?? postScrydexVision;
  const getCredentials = options?.getCredentials ?? getScrydexCredentials;

  return {
    id: "scrydex",
    async identifyCard(input) {
      const credentials = getCredentials();
      if (!credentials) {
        throw new RecognitionError("provider_unavailable", "Card recognition is unavailable.");
      }

      let payload: unknown;
      try {
        payload = await post({ ...input, ...credentials });
      } catch (error) {
        throw toRecognitionError(error);
      }

      const mapped = mapScrydexVisionResponse(payload);
      return {
        provider: "scrydex",
        game: mapped.game,
        candidates: mapped.candidates,
      };
    },
  };
}
