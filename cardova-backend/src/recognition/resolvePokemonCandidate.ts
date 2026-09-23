import { canonicalCardId } from "../domain/card.js";
import type { RecognitionCandidate } from "../domain/recognition.js";

export interface PokemonPrintRecord {
  apiId: string;
  cardName: string;
  cardNumber: string | null;
  setId: string | null;
  setName: string | null;
}

function normalized(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function numbersEqual(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = normalized(left);
  const b = normalized(right);
  if (!a || !b) return false;
  if (a === b) return true;
  if (/^\d+$/.test(a) && /^\d+$/.test(b)) return String(Number(a)) === String(Number(b));
  return false;
}

function isEnglish(language: string | null): boolean {
  if (!language) return true;
  const value = language.trim().toLowerCase();
  return value === "en" || value === "english";
}

function sameField(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = normalized(left);
  const b = normalized(right);
  return Boolean(a) && a === b;
}

function unresolved(candidate: RecognitionCandidate): RecognitionCandidate {
  return { ...candidate, canonicalCardId: null, resolutionStatus: "unresolved" };
}

function ambiguous(candidate: RecognitionCandidate): RecognitionCandidate {
  return { ...candidate, canonicalCardId: null, resolutionStatus: "ambiguous" };
}

function resolved(candidate: RecognitionCandidate, row: PokemonPrintRecord): RecognitionCandidate {
  return {
    ...candidate,
    canonicalCardId: canonicalCardId("pokemon", row.apiId),
    resolutionStatus: "resolved",
  };
}

export function resolvePokemonCandidate(
  candidate: RecognitionCandidate,
  rows: PokemonPrintRecord[]
): RecognitionCandidate {
  if (candidate.game !== "Pokemon" || !isEnglish(candidate.language)) return unresolved(candidate);
  if (!candidate.name || !candidate.cardNumber) return unresolved(candidate);

  const name = normalized(candidate.name);
  const prints = rows.filter(
    (row) => normalized(row.cardName) === name && numbersEqual(row.cardNumber, candidate.cardNumber)
  );

  if (prints.length === 0) return unresolved(candidate);

  const hasSetId = normalized(candidate.setId).length > 0;
  const hasSetName = normalized(candidate.setName).length > 0;
  const setIdHits = hasSetId ? prints.filter((row) => sameField(row.setId, candidate.setId)) : [];
  const setNameHits = hasSetName ? prints.filter((row) => sameField(row.setName, candidate.setName)) : [];

  if (hasSetId && setIdHits.length === 1) {
    const hit = setIdHits[0] as PokemonPrintRecord;
    if (hasSetName && setNameHits.length > 0 && !setNameHits.includes(hit)) return ambiguous(candidate);
    return resolved(candidate, hit);
  }
  if (hasSetId && setIdHits.length > 1) return ambiguous(candidate);

  if (hasSetName && setNameHits.length === 1) {
    const hit = setNameHits[0] as PokemonPrintRecord;
    if (hasSetId && setIdHits.length > 0 && !setIdHits.includes(hit)) return ambiguous(candidate);
    return resolved(candidate, hit);
  }
  if (hasSetName && setNameHits.length > 1) return ambiguous(candidate);

  if (hasSetId || hasSetName) return unresolved(candidate);
  if (prints.length === 1) return resolved(candidate, prints[0] as PokemonPrintRecord);
  return ambiguous(candidate);
}
