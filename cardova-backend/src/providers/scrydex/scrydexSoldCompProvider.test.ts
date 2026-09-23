import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fetchScrydexSoldComps, MAX_SOLD_COMP_PAGES, MarketDataError } from "./scrydexSoldCompProvider.js";

function page(count: number, total: number) {
  return JSON.stringify({
    data: Array.from({ length: count }, (_, index) => ({
      id: `listing-${index}`,
      source: "ebay",
      title: "Card",
      price: 10,
      currency: "USD",
      sold_at: "2026/09/01",
    })),
    page: 1,
    page_size: count,
    total_count: total,
  });
}

describe("fetchScrydexSoldComps", () => {
  it("stops at the page bound and does not request price history", async () => {
    const urls: string[] = [];
    const result = await fetchScrydexSoldComps(
      { cardId: "pokemon:base1-4", providerCardId: "base1-4" },
      {
        getCredentials: () => ({ apiKey: "test-key", teamId: "test-team" }),
        fetchImpl: async (input) => {
          urls.push(String(input));
          return new Response(page(100, 99999), { status: 200 });
        },
      }
    );
    assert.equal(result.pagesFetched, MAX_SOLD_COMP_PAGES);
    assert.equal(result.windowComplete, false);
    assert.equal(urls.length, MAX_SOLD_COMP_PAGES);
    assert.equal(urls.every((url) => url.includes("days=90")), true);
    assert.equal(urls.every((url) => !url.includes("price_history")), true);
    assert.equal(JSON.stringify(result).includes("test-key"), false);
  });

  it("hides a provider failure body", async () => {
    await assert.rejects(
      fetchScrydexSoldComps(
        { cardId: "pokemon:base1-4", providerCardId: "base1-4" },
        {
          getCredentials: () => ({ apiKey: "test-key", teamId: "test-team" }),
          fetchImpl: async () => new Response("team-secret-should-not-leak", { status: 400 }),
        }
      ),
      (error: unknown) => {
        assert.ok(error instanceof MarketDataError);
        assert.equal(error.code, "provider_unavailable");
        assert.equal(error.message.includes("team-secret"), false);
        assert.equal(error.message.includes("test-key"), false);
        return true;
      }
    );
  });
});
