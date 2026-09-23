import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fetchScrydexPokemonCardsPage,
  scrydexEnglishPokemonCardsUrl,
} from "./scrydexPokemonCatalog.js";

describe("scrydexEnglishPokemonCardsUrl", () => {
  it("requests English identity fields and does not ask for prices", () => {
    const url = scrydexEnglishPokemonCardsUrl(2);
    assert.equal(url.pathname, "/pokemon/v1/en/cards");
    assert.equal(url.searchParams.get("page"), "2");
    assert.equal(url.searchParams.get("page_size"), "100");
    assert.equal(url.searchParams.get("include"), null);
    assert.equal(url.toString().toLowerCase().includes("price"), false);
  });
});

describe("fetchScrydexPokemonCardsPage", () => {
  it("does not call Scrydex when credentials are missing", async () => {
    let called = false;
    await assert.rejects(
      fetchScrydexPokemonCardsPage(1, {
        getCredentials: () => null,
        fetchImpl: async () => {
          called = true;
          return new Response("{}", { status: 200 });
        },
      }),
      /SCRYDEX_API_KEY/
    );
    assert.equal(called, false);
  });

  it("retries a transient provider error without reading a price resource", async () => {
    const urls: string[] = [];
    let attempts = 0;
    const page = await fetchScrydexPokemonCardsPage(1, {
      getCredentials: () => ({ apiKey: "test-key", teamId: "test-team" }),
      fetchImpl: async (input) => {
        attempts += 1;
        urls.push(String(input));
        if (attempts === 1) {
          return new Response("busy", { status: 429, headers: { "Retry-After": "0" } });
        }
        return new Response(
          JSON.stringify({
            data: [{ id: "base1-4", name: "Charizard" }],
            page: 1,
            page_size: 100,
            count: 1,
            total_count: 1,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      },
    });

    assert.equal(attempts, 2);
    assert.equal(page.totalCount, 1);
    assert.equal(page.data.length, 1);
    assert.equal(urls.every((url) => !url.toLowerCase().includes("price")), true);
    assert.equal(JSON.stringify(page).includes("test-key"), false);
  });
});
