import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RecognitionCandidate } from "../domain/recognition.js";
import { resolvePokemonCandidate, type PokemonPrintRecord } from "./resolvePokemonCandidate.js";

const base: PokemonPrintRecord = {
  apiId: "base1-4",
  cardName: "Charizard",
  cardNumber: "4",
  setId: "base1",
  setName: "Base",
};

const fossil: PokemonPrintRecord = {
  apiId: "fossil-4",
  cardName: "Charizard",
  cardNumber: "4",
  setId: "base3",
  setName: "Fossil",
};

function candidate(overrides: Partial<RecognitionCandidate> = {}): RecognitionCandidate {
  return {
    provider: "scrydex",
    providerCardId: "provider-card-999",
    providerScore: 1.1,
    confidence: null,
    game: "Pokemon",
    language: "EN",
    name: "Charizard",
    setId: "base1",
    setName: "Base",
    cardNumber: "4",
    variant: null,
    finish: null,
    imageUrl: null,
    canonicalCardId: null,
    resolutionStatus: "unresolved",
    ...overrides,
  };
}

describe("resolvePokemonCandidate", () => {
  it("resolves one exact name, number, and set match to the catalog api id", () => {
    const result = resolvePokemonCandidate(candidate(), [base, fossil]);
    assert.equal(result.resolutionStatus, "resolved");
    assert.equal(result.canonicalCardId, "pokemon:base1-4");
    assert.notEqual(result.canonicalCardId, `pokemon:${result.providerCardId}`);
  });

  it("stays unresolved when the catalog has no matching print", () => {
    const result = resolvePokemonCandidate(candidate(), []);
    assert.equal(result.resolutionStatus, "unresolved");
    assert.equal(result.canonicalCardId, null);
  });

  it("stays unresolved when the provider set does not match any print", () => {
    const result = resolvePokemonCandidate(candidate({ setName: "Base Set", setId: null }), [base, fossil]);
    assert.equal(result.resolutionStatus, "unresolved");
    assert.equal(result.canonicalCardId, null);
  });

  it("does not attach the only name and number row when the provider set conflicts", () => {
    const result = resolvePokemonCandidate(candidate({ setId: "base2", setName: "Jungle" }), [base]);
    assert.equal(result.resolutionStatus, "unresolved");
    assert.equal(result.canonicalCardId, null);
  });

  it("resolves a unique name and number when the provider omitted the set", () => {
    const result = resolvePokemonCandidate(candidate({ setId: null, setName: null }), [base]);
    assert.equal(result.resolutionStatus, "resolved");
    assert.equal(result.canonicalCardId, "pokemon:base1-4");
  });

  it("resolves by set name when the provider set id is not in the catalog", () => {
    const result = resolvePokemonCandidate(candidate({ setId: "scrydex-base", setName: "Base" }), [base, fossil]);
    assert.equal(result.resolutionStatus, "resolved");
    assert.equal(result.canonicalCardId, "pokemon:base1-4");
  });

  it("stays ambiguous when the provider set id and set name pick different prints", () => {
    const result = resolvePokemonCandidate(candidate({ setId: "base1", setName: "Fossil" }), [base, fossil]);
    assert.equal(result.resolutionStatus, "ambiguous");
    assert.equal(result.canonicalCardId, null);
  });

  it("does not attach an English catalog id to a non-English candidate", () => {
    const result = resolvePokemonCandidate(candidate({ language: "JA" }), [base]);
    assert.equal(result.resolutionStatus, "unresolved");
    assert.equal(result.canonicalCardId, null);
  });
});
