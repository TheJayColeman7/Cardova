import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RecognitionError } from "../../recognition/recognitionError.js";
import { mapScrydexVisionResponse } from "./mapScrydexVision.js";

const payload = {
  data: {
    analysis: { type: "raw", game: "pokemon", language_code: "EN" },
    matches: [
      {
        score: 1.13252,
        variant: "Holofoil",
        card: {
          id: "base1-4",
          name: "Charizard",
          number: "4",
          expansion: { id: "base1", name: "Base" },
          images: [{ type: "front", small: "https://images.example/charizard.png" }],
        },
      },
    ],
  },
};

describe("mapScrydexVisionResponse", () => {
  it("maps a Vision match without copying the provider id into the canonical id", () => {
    const mapped = mapScrydexVisionResponse(payload);
    const candidate = mapped.candidates[0];

    assert.equal(mapped.game, "Pokemon");
    assert.ok(candidate);
    assert.equal(candidate.provider, "scrydex");
    assert.equal(candidate.providerCardId, "base1-4");
    assert.equal(candidate.providerScore, 1.13252);
    assert.equal(candidate.confidence, null);
    assert.equal(candidate.name, "Charizard");
    assert.equal(candidate.setName, "Base");
    assert.equal(candidate.cardNumber, "4");
    assert.equal(candidate.language, "EN");
    assert.equal(candidate.finish, "Holofoil");
    assert.equal(candidate.imageUrl, "https://images.example/charizard.png");
    assert.equal(candidate.canonicalCardId, null);
    assert.equal(candidate.resolutionStatus, "unresolved");
  });

  it("rejects a response that does not match the Vision contract", () => {
    assert.throws(
      () => mapScrydexVisionResponse({ error: "api-key-should-not-leak", data: { matches: [{ card: {} }] } }),
      (error: unknown) => {
        assert.ok(error instanceof RecognitionError);
        assert.equal(error.code, "provider_response");
        assert.equal(error.message.includes("api-key"), false);
        return true;
      }
    );
  });

  it("returns no candidates when Vision found no matches", () => {
    const mapped = mapScrydexVisionResponse({
      data: { analysis: { game: "pokemon", language_code: "EN" }, matches: [] },
    });
    assert.deepEqual(mapped.candidates, []);
  });
});
