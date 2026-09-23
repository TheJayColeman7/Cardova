import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isActiveListing, isSoldComp, type MarketplaceListing, type SampleSale, type SoldComp } from "./market.js";
import { mean, median, summarizeBucket, summarizeSoldComps, usdSoldComps } from "./marketSummary.js";

const NOW = new Date("2026-09-23T00:00:00.000Z");

function comp(overrides: Partial<SoldComp> = {}): SoldComp {
  return {
    dataType: "sold_comp",
    marketplace: "ebay",
    externalId: "listing-1",
    cardId: "pokemon:base1-4",
    title: "Charizard",
    soldPrice: 100,
    shipping: null,
    currency: "USD",
    gradingCompany: null,
    grade: null,
    soldAt: "2026-09-01",
    source: "scrydex",
    variant: "unlimitedHolofoil",
    condition: "NM",
    perfect: false,
    signed: false,
    error: false,
    url: "https://example.test/listing",
    ...overrides,
  };
}

describe("sold comp summary", () => {
  it("calculates an odd-count median and an even-count median", () => {
    assert.equal(median([9, 1, 3]), 3);
    assert.equal(median([1, 2, 3, 4]), 2.5);
    assert.equal(mean([1, 2, 3]), 2);
  });

  it("keeps raw, PSA 9, PSA 10, and BGS 10 in separate buckets", () => {
    const summary = summarizeSoldComps([
      comp({ externalId: "raw", soldPrice: 50 }),
      comp({ externalId: "psa9", gradingCompany: "PSA", grade: "9", soldPrice: 400, condition: null }),
      comp({ externalId: "psa10", gradingCompany: "PSA", grade: "10", soldPrice: 1000, condition: null }),
      comp({ externalId: "bgs10", gradingCompany: "BGS", grade: "10", soldPrice: 1200, condition: null }),
    ]);
    assert.equal(summary.raw.saleCount, 1);
    assert.equal(summary.grades.PSA?.["9"]?.saleCount, 1);
    assert.equal(summary.grades.PSA?.["10"]?.latestSale?.soldPrice, 1000);
    assert.equal(summary.grades.BGS?.["10"]?.latestSale?.soldPrice, 1200);
    assert.notEqual(summary.grades.PSA?.["9"]?.latestSale?.soldPrice, summary.grades.PSA?.["10"]?.latestSale?.soldPrice);
  });

  it("does not combine a non-USD sale into the USD median", () => {
    const { included } = usdSoldComps(
      [
        comp({ soldPrice: 10, soldAt: "2026-09-01" }),
        comp({ soldPrice: 30, soldAt: "2026-09-02", externalId: "b" }),
        comp({ soldPrice: 20, soldAt: "2026-09-03", externalId: "c" }),
        comp({ soldPrice: 5000, currency: "EUR", externalId: "eur" }),
      ],
      NOW
    );
    const bucket = summarizeBucket(included);
    assert.equal(bucket.median, 20);
    assert.equal(bucket.saleCount, 3);
    assert.equal(included.some((item) => item.currency === "EUR"), false);
  });

  it("uses last sale for one sale and a normal median for three", () => {
    const single = summarizeBucket([comp({ soldPrice: 410 })]);
    assert.equal(single.evidence, "single");
    assert.equal(single.latestSale?.soldPrice, 410);
    assert.equal(single.median, null);

    const three = summarizeBucket([
      comp({ soldPrice: 365, externalId: "a" }),
      comp({ soldPrice: 475, externalId: "b" }),
      comp({ soldPrice: 420, externalId: "c" }),
    ]);
    assert.equal(three.evidence, "summary");
    assert.equal(three.median, 420);
    assert.equal(three.minimum, 365);
    assert.equal(three.maximum, 475);
  });

  it("returns an unavailable bucket when there are no sales", () => {
    const none = summarizeBucket([]);
    assert.equal(none.evidence, "none");
    assert.equal(none.median, null);
    assert.equal(none.latestSale, null);
  });

  it("does not treat a sample sale or an active listing as a sold comp", () => {
    const sample: SampleSale = {
      dataType: "sample",
      title: "Demo",
      price: 10,
      currency: "USD",
      date: "2026-09-01",
      gradingCompany: "PSA",
      grade: "10",
      label: "PSA 10",
    };
    const listing: MarketplaceListing = {
      dataType: "active_listing",
      marketplace: "ebay",
      listingId: "1",
      title: "Ask",
      price: 99,
      shipping: null,
      totalPrice: null,
      currency: "USD",
      condition: null,
      gradingCompany: null,
      grade: null,
      seller: null,
      imageUrl: null,
      url: "https://example.test",
      listingType: "fixed_price",
      observedAt: "2026-09-01",
    };
    assert.equal(isSoldComp(sample), false);
    assert.equal(isActiveListing(listing), true);
    assert.equal(isSoldComp(listing), false);
    const { included, exclusions } = usdSoldComps([sample as unknown as SoldComp, listing as unknown as SoldComp], NOW);
    assert.equal(included.length, 0);
    assert.equal(exclusions.notSoldComp, 2);
  });
});
