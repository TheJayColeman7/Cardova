import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { CatalogCardSource } from "../adapters/catalogCardAdapter.js";
import type { CardRecognitionProvider, RecognitionCandidate, RecognitionImage } from "../domain/recognition.js";
import type { PokemonPrintRecord } from "../recognition/resolvePokemonCandidate.js";
import { createCardService } from "./cardService.js";
import { createRecognitionService } from "./recognitionService.js";

const image: RecognitionImage = {
  bytes: Buffer.from([0xff, 0xd8, 0xff]),
  mimeType: "image/jpeg",
};

function candidate(overrides: Partial<RecognitionCandidate> = {}): RecognitionCandidate {
  return {
    provider: "scrydex",
    providerCardId: "base1-4",
    providerScore: 1.2,
    confidence: null,
    game: "Pokemon",
    language: "EN",
    name: "Charizard",
    setId: "base1",
    setName: "Base",
    cardNumber: "4",
    variant: null,
    finish: null,
    imageUrl: "https://images.example/charizard.png",
    canonicalCardId: null,
    resolutionStatus: "unresolved",
    ...overrides,
  };
}

function provider(candidates: RecognitionCandidate[]): CardRecognitionProvider {
  return {
    id: "scrydex",
    async identifyCard() {
      return { provider: "scrydex", game: candidates[0]?.game ?? "Pokemon", candidates };
    },
  };
}

const basePrint: PokemonPrintRecord = {
  apiId: "base1-4",
  cardName: "Charizard",
  cardNumber: "4",
  setId: "base1",
  setName: "Base",
};

describe("recognition service", () => {
  it("resolves a provider match only through the catalog api id", async () => {
    const service = createRecognitionService({
      provider: provider([candidate({ providerCardId: "not-the-catalog-id" })]),
      pokemon: {
        async findByNameAndNumber() {
          return [basePrint];
        },
      },
    });

    const result = await service.recognize(image);
    assert.equal(result.outcome, "candidates");
    assert.equal(result.candidates[0]?.canonicalCardId, "pokemon:base1-4");
    assert.equal(result.candidates[0]?.providerCardId, "not-the-catalog-id");
    assert.equal(Object.hasOwn(result, "soldComps"), false);
  });

  it("returns a no-match response when the provider finds nothing", async () => {
    const service = createRecognitionService({
      provider: provider([]),
      pokemon: {
        async findByNameAndNumber() {
          throw new Error("should not query");
        },
      },
    });

    const result = await service.recognize(image);
    assert.equal(result.outcome, "no_card_detected");
    assert.deepEqual(result.candidates, []);
  });

  it("leaves sold comps empty on the existing card detail for a resolved id", async () => {
    const catalog = JSON.parse(
      readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../catalog.json"), "utf8")
    ) as CatalogCardSource[];
    const cards = createCardService({
      catalog,
      pokemon: {
        async searchByName() {
          return [];
        },
        async getById(id) {
          if (id === "base1-4") {
            return {
              apiId: "base1-4",
              cardName: "Charizard",
              cardNumber: "4",
              setId: "base1",
              setName: "Base",
              seriesName: "Base",
              rarity: "Rare Holo",
              imageSmallUrl: null,
              imageLargeUrl: null,
              releaseDate: "1999-01-09",
            };
          }
          return null;
        },
      },
    });

    const detail = await cards.getCardDetail("pokemon:base1-4");
    assert.ok(detail);
    assert.equal(detail.card.id, "pokemon:base1-4");
    assert.deepEqual(detail.soldComps, []);
  });
});
