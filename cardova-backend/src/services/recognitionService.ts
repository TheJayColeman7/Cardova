import type { CardRecognitionProvider, RecognitionCandidate, RecognitionImage, RecognitionResult } from "../domain/recognition.js";
import { RecognitionError } from "../recognition/recognitionError.js";
import { resolvePokemonCandidate, type PokemonPrintRecord } from "../recognition/resolvePokemonCandidate.js";

export const MAX_RECOGNITION_CANDIDATES = 5;

export interface PokemonRecognitionCatalog {
  findByNameAndNumber(name: string, cardNumber: string): Promise<PokemonPrintRecord[]>;
}

export function createRecognitionService(deps: {
  provider: CardRecognitionProvider;
  pokemon: PokemonRecognitionCatalog;
}) {
  async function resolveCandidate(candidate: RecognitionCandidate): Promise<RecognitionCandidate> {
    if (candidate.game !== "Pokemon" || !candidate.name || !candidate.cardNumber) {
      return { ...candidate, canonicalCardId: null, resolutionStatus: "unresolved" };
    }

    try {
      const rows = await deps.pokemon.findByNameAndNumber(candidate.name, candidate.cardNumber);
      return resolvePokemonCandidate(candidate, rows);
    } catch (error) {
      console.error(
        "Pokemon catalog unavailable during recognition:",
        error instanceof Error ? error.message : "lookup failed"
      );
      return { ...candidate, canonicalCardId: null, resolutionStatus: "unresolved" };
    }
  }

  return {
    async recognize(image: RecognitionImage): Promise<RecognitionResult> {
      const started = Date.now();
      console.info("recognition request started", {
        mimeType: image.mimeType,
        bytes: image.bytes.length,
      });

      let identified: Awaited<ReturnType<CardRecognitionProvider["identifyCard"]>>;
      try {
        identified = await deps.provider.identifyCard(image);
      } catch (error) {
        if (error instanceof RecognitionError) throw error;
        throw new RecognitionError("provider_unavailable", "Card recognition is unavailable.");
      }

      const limited = identified.candidates.slice(0, MAX_RECOGNITION_CANDIDATES);
      const candidates: RecognitionCandidate[] = [];
      for (const candidate of limited) {
        candidates.push(await resolveCandidate(candidate));
      }

      console.info("recognition provider finished", {
        provider: identified.provider,
        latencyMs: Date.now() - started,
        candidateCount: candidates.length,
        resolutionStatus: candidates.map((candidate) => candidate.resolutionStatus),
      });

      return {
        provider: identified.provider,
        game: identified.game,
        outcome: candidates.length === 0 ? "no_card_detected" : "candidates",
        candidates,
      };
    },
  };
}
