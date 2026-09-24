import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Card } from "../domain/card.js";
import type { SoldComp } from "../domain/market.js";
import { isSampleMarketRecord } from "../domain/market.js";
import type { SoldCompFetchResult } from "../providers/scrydex/scrydexSoldCompProvider.js";
import { createMarketService } from "./marketService.js";

const card: Card = {
  id: "pokemon:base1-4",
  source: "pokemon",
  sourceId: "base1-4",
  game: "Pokemon",
  sport: null,
  name: "Charizard",
  year: 1999,
  manufacturer: null,
  setId: "base1",
  setName: "Base",
  series: "Base",
  subset: null,
  cardNumber: "4",
  parallel: null,
  variation: null,
  rarity: "Rare Holo",
  finish: null,
  language: null,
  rookie: null,
  firstEdition: null,
  imageSmallUrl: null,
  imageLargeUrl: null,
};

function comp(overrides: Partial<SoldComp> = {}): SoldComp {
  return {
    dataType: "sold_comp",
    marketplace: "ebay",
    externalId: "a",
    cardId: card.id,
    title: "Charizard",
    soldPrice: 100,
    shipping: null,
    currency: "USD",
    gradingCompany: "PSA",
    grade: "10",
    soldAt: "2026-09-01",
    source: "scrydex",
    variant: "unlimitedHolofoil",
    condition: null,
    perfect: null,
    signed: null,
    error: null,
    url: "https://example.test/a",
    ...overrides,
  };
}

describe("createMarketService", () => {
  it("keeps variants separate until one is selected and caches the provider call", async () => {
    let calls = 0;
    const fetched: SoldCompFetchResult = {
      windowComplete: true,
      pagesFetched: 1,
      comps: [
        comp({ externalId: "holo", variant: "unlimitedHolofoil", soldPrice: 1000 }),
        comp({ externalId: "first", variant: "firstEditionShadowlessHolofoil", soldPrice: 5000, grade: "10" }),
      ],
    };
    const service = createMarketService({
      now: () => Date.parse("2026-09-23T00:00:00.000Z"),
      fetchSoldComps: async () => {
        calls += 1;
        return fetched;
      },
    });

    const first = await service.getMarket(card, null);
    const second = await service.getMarket(card, "unlimitedHolofoil");
    assert.equal(calls, 1);
    assert.equal(first.cached, false);
    assert.equal(second.cached, true);
    assert.equal(first.selectionRequired, true);
    assert.equal(first.summaries, null);
    assert.deepEqual(first.variants, ["firstEditionShadowlessHolofoil", "unlimitedHolofoil"]);
    assert.equal(second.variant, "unlimitedHolofoil");
    assert.equal(second.summaries?.grades.PSA?.["10"]?.saleCount, 1);
    assert.equal(second.soldComps.every((item) => item.variant === "unlimitedHolofoil"), true);
    assert.equal(second.soldComps.some((item) => isSampleMarketRecord(item)), false);
    assert.equal(second.summaries?.grades.PSA?.["8"]?.saleCount, 0);
  });

  it("keeps an excluded contradictory comp visible and out of the actionable median", async () => {
    const service = createMarketService({
      now: () => Date.parse("2026-09-23T00:00:00.000Z"),
      fetchSoldComps: async () => ({
        windowComplete: true,
        pagesFetched: 1,
        comps: [
          comp({ externalId: "en", title: "Charizard #4", soldPrice: 500, gradingCompany: null, grade: null }),
          comp({ externalId: "jp", title: "Japanese Charizard #4", soldPrice: 40, gradingCompany: null, grade: null }),
          comp({
            externalId: "other-variant",
            variant: "firstEditionShadowlessHolofoil",
            title: "Charizard #4",
            soldPrice: 8000,
            gradingCompany: null,
            grade: null,
          }),
        ],
      }),
    });

    const market = await service.getMarket(card, "unlimitedHolofoil");
    assert.equal(market.summaries?.rawConditions.Unknown.saleCount, 1);
    assert.equal(market.summaries?.rawConditions.Unknown.latestSale?.soldPrice, 500);
    assert.equal(market.summaries?.rawConditions.NM.saleCount, 0);
    assert.equal(market.soldComps.some((item) => item.externalId === "jp"), true);
    assert.equal(market.soldComps.find((item) => item.externalId === "jp")?.quality.disposition, "excluded");
    assert.equal(market.soldComps.some((item) => item.externalId === "other-variant"), false);
    assert.equal(market.quality.included, 1);
    assert.equal(market.quality.excluded, 1);
  });
});
