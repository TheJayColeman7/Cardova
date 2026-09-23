import type { RecognitionCandidate } from "../../domain/recognition.js";
import { RecognitionError } from "../../recognition/recognitionError.js";

const GAME_NAMES: Record<string, string> = {
  pokemon: "Pokemon",
  onepiece: "One Piece",
  magicthegathering: "Magic",
  lorcana: "Lorcana",
  riftbound: "Riftbound",
  gundam: "Gundam",
};

const FINISH_LABELS = new Set(["holo", "holofoil", "reverse holo", "reverse holofoil"]);

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function score(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function gameName(value: unknown): string | null {
  const code = text(value)?.toLowerCase();
  if (!code) return null;
  return GAME_NAMES[code] ?? null;
}

function imageUrl(card: Record<string, unknown>): string | null {
  if (!Array.isArray(card.images) || card.images.length === 0) return null;
  const images = card.images.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null);
  const front = images.find((item) => item.type === "front") ?? images[0];
  if (!front) return null;
  return text(front.small) ?? text(front.medium) ?? text(front.large);
}

function variantAndFinish(value: unknown): { variant: string | null; finish: string | null } {
  const label = text(value);
  if (!label) return { variant: null, finish: null };
  if (FINISH_LABELS.has(label.toLowerCase())) return { variant: null, finish: label };
  return { variant: label, finish: null };
}

export interface ScrydexVisionMapping {
  game: string | null;
  candidates: RecognitionCandidate[];
}

export function mapScrydexVisionResponse(payload: unknown): ScrydexVisionMapping {
  if (!payload || typeof payload !== "object") {
    throw new RecognitionError("provider_response", "Recognition returned an unexpected response.");
  }

  const data = (payload as { data?: unknown }).data;
  if (!data || typeof data !== "object") {
    throw new RecognitionError("provider_response", "Recognition returned an unexpected response.");
  }

  const analysis = (data as { analysis?: unknown }).analysis;
  const matches = (data as { matches?: unknown }).matches;
  if (!Array.isArray(matches)) {
    throw new RecognitionError("provider_response", "Recognition returned an unexpected response.");
  }

  const analysisRecord = analysis && typeof analysis === "object" ? (analysis as Record<string, unknown>) : {};
  const game = gameName(analysisRecord.game);
  const language = text(analysisRecord.language_code);

  const candidates: RecognitionCandidate[] = [];
  for (const match of matches) {
    if (!match || typeof match !== "object") continue;
    const record = match as Record<string, unknown>;
    const card = record.card;
    if (!card || typeof card !== "object") continue;
    const cardRecord = card as Record<string, unknown>;
    const providerCardId = text(cardRecord.id);
    if (!providerCardId) continue;

    const expansion = cardRecord.expansion;
    const expansionRecord =
      expansion && typeof expansion === "object" ? (expansion as Record<string, unknown>) : {};
    const printing = variantAndFinish(record.variant);

    candidates.push({
      provider: "scrydex",
      providerCardId,
      providerScore: score(record.score),
      confidence: null,
      game,
      language: language ?? text(cardRecord.language_code),
      name: text(cardRecord.name),
      setId: text(expansionRecord.id),
      setName: text(expansionRecord.name),
      cardNumber: text(cardRecord.number),
      variant: printing.variant,
      finish: printing.finish,
      imageUrl: imageUrl(cardRecord),
      canonicalCardId: null,
      resolutionStatus: "unresolved",
    });
  }

  if (matches.length > 0 && candidates.length === 0) {
    throw new RecognitionError("provider_response", "Recognition returned an unexpected response.");
  }

  return { game, candidates };
}
