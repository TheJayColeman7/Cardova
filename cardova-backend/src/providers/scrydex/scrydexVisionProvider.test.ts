import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RecognitionImage } from "../../domain/recognition.js";
import { RecognitionError } from "../../recognition/recognitionError.js";
import { createScrydexVisionProvider } from "./scrydexVisionProvider.js";

const image: RecognitionImage = {
  bytes: Buffer.from([0xff, 0xd8, 0xff]),
  mimeType: "image/jpeg",
};

describe("createScrydexVisionProvider", () => {
  it("does not call Scrydex when credentials are missing", async () => {
    let called = false;
    const provider = createScrydexVisionProvider({
      getCredentials: () => null,
      post: async () => {
        called = true;
        return {};
      },
    });

    await assert.rejects(provider.identifyCard(image), (error: unknown) => {
      assert.ok(error instanceof RecognitionError);
      assert.equal(error.code, "provider_unavailable");
      assert.equal(error.message.includes("SCRYDEX"), false);
      return true;
    });
    assert.equal(called, false);
  });

  it("hides provider failure bodies from the application error", async () => {
    const provider = createScrydexVisionProvider({
      getCredentials: () => ({ apiKey: "test-key", teamId: "test-team" }),
      post: async () => {
        throw { status: 500, body: "team-secret-should-not-leak" };
      },
    });

    await assert.rejects(provider.identifyCard(image), (error: unknown) => {
      assert.ok(error instanceof RecognitionError);
      assert.equal(error.code, "provider_unavailable");
      assert.equal(error.message.includes("team-secret"), false);
      assert.equal(error.message.includes("test-key"), false);
      return true;
    });
  });
});
