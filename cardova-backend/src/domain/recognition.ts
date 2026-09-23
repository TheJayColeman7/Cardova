export type ResolutionStatus = "resolved" | "ambiguous" | "unresolved";

export type RecognitionOutcome = "candidates" | "no_card_detected";

/**
 * Evidence from a recognition provider. This is not a Sweet Home Cards Card.
 * providerCardId must not be copied into canonicalCardId.
 */
export interface RecognitionCandidate {
  provider: string;
  providerCardId: string;
  providerScore: number | null;
  confidence: number | null;
  game: string | null;
  language: string | null;
  name: string | null;
  setId: string | null;
  setName: string | null;
  cardNumber: string | null;
  variant: string | null;
  finish: string | null;
  imageUrl: string | null;
  canonicalCardId: string | null;
  resolutionStatus: ResolutionStatus;
}

export interface RecognitionResult {
  provider: string;
  game: string | null;
  outcome: RecognitionOutcome;
  candidates: RecognitionCandidate[];
}

export interface RecognitionImage {
  bytes: Buffer;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
}

export interface CardRecognitionProvider {
  readonly id: string;
  identifyCard(input: RecognitionImage): Promise<{
    provider: string;
    game: string | null;
    candidates: RecognitionCandidate[];
  }>;
}
