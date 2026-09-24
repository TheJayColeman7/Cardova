import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MarketplaceListing, SoldComp } from "./market.js";
import { evaluateCompQuality, extremePriceBounds, type CompCardIdentity } from "./compQuality.js";
import { summarizeSoldComps, usdSoldComps } from "./marketSummary.js";

const NOW = new Date("2026-09-23T00:00:00.000Z");

const charizard: CompCardIdentity = {
  name: "Charizard",
  setName: "Base",
  cardNumber: "4",
  language: "English",
  variant: "unlimitedHolofoil",
};

function comp(overrides: Partial<SoldComp> = {}): SoldComp {
  return {
    dataType: "sold_comp",
    marketplace: "ebay",
    externalId: "listing-1",
    cardId: "pokemon:base1-4",
    title: "Charizard",
    soldPrice: 500,
    shipping: null,
    currency: "USD",
    gradingCompany: null,
    grade: null,
    soldAt: "2026-09-01",
    source: "scrydex",
    variant: "unlimitedHolofoil",
    condition: "NM",
    perfect: null,
    signed: null,
    error: null,
    url: "https://example.test/listing",
    ...overrides,
  };
}

function codes(title: string, overrides: Partial<SoldComp> = {}) {
  const [evaluated] = evaluateCompQuality([comp({ title, ...overrides })], charizard);
  return evaluated?.flags.map((flag) => flag.code) ?? [];
}

describe("comp quality", () => {
  it("excludes an explicit wrong set title", () => {
    const [evaluated] = evaluateCompQuality(
      [comp({ title: "Base Set 2 Charizard #4 Holo", soldPrice: 80 })],
      charizard
    );
    assert.equal(evaluated?.disposition, "excluded");
    assert.ok(evaluated?.flags.some((flag) => flag.code === "title_set_conflict" && flag.severity === "exclude"));
  });

  it("excludes an explicit wrong language", () => {
    const [evaluated] = evaluateCompQuality(
      [comp({ title: "Japanese Charizard Base Set #4", soldPrice: 40 })],
      charizard
    );
    assert.equal(evaluated?.disposition, "excluded");
    assert.ok(evaluated?.flags.some((flag) => flag.code === "wrong_language" && flag.severity === "exclude"));
  });

  it("excludes an obvious lot or bundle", () => {
    const [evaluated] = evaluateCompQuality(
      [comp({ title: "Charizard lot Base Set #4", soldPrice: 20 })],
      charizard
    );
    assert.equal(evaluated?.disposition, "excluded");
    assert.ok(evaluated?.flags.some((flag) => flag.code === "lot_or_bundle" && flag.severity === "exclude"));
  });

  it("excludes a title that names a different card even when the collector number matches", () => {
    const [evaluated] = evaluateCompQuality(
      [comp({ title: "Pokemon TCG 2010 HGSS Triumphant Drapion Holo Rare 4/102 PSA 10", gradingCompany: "PSA", grade: "10", condition: null })],
      charizard
    );
    assert.equal(evaluated?.disposition, "excluded");
    assert.ok(evaluated?.flags.some((flag) => flag.code === "title_name_conflict" && flag.severity === "exclude"));
  });

  it("excludes an ungraded sale whose title says it is graded", () => {
    const [evaluated] = evaluateCompQuality(
      [comp({ title: "Charizard Base Set Holo Rare 4/102 PSA Graded", gradingCompany: null, grade: null })],
      charizard
    );
    assert.equal(evaluated?.disposition, "excluded");
    assert.ok(evaluated?.flags.some((flag) => flag.code === "grade_conflict"));
  });

  it("does not exclude a title only because the set name is absent", () => {
    const [evaluated] = evaluateCompQuality([comp({ title: "Charizard Holo #4" })], charizard);
    assert.equal(evaluated?.disposition, "included");
    assert.deepEqual(evaluated?.flags, []);
  });

  it("does not treat a personal collection phrase as a lot", () => {
    const [evaluated] = evaluateCompQuality(
      [comp({ title: "Charizard from my collection #4" })],
      charizard
    );
    assert.equal(evaluated?.disposition, "included");
    assert.equal(codes("Charizard from my collection #4").includes("lot_or_bundle"), false);
  });

  it("deduplicates a repeated external listing id", () => {
    const evaluated = evaluateCompQuality(
      [
        comp({ externalId: "same", soldPrice: 400, title: "Charizard #4" }),
        comp({ externalId: "same", soldPrice: 400, title: "Charizard #4", url: "https://example.test/copy" }),
      ],
      charizard
    );
    assert.equal(evaluated[0]?.disposition, "included");
    assert.equal(evaluated[1]?.disposition, "excluded");
    assert.ok(evaluated[1]?.flags.some((flag) => flag.code === "duplicate_listing"));
    const summary = summarizeSoldComps(
      [
        comp({ externalId: "same", soldPrice: 400, title: "Charizard #4" }),
        comp({ externalId: "same", soldPrice: 900, title: "Charizard #4" }),
      ],
      { identity: charizard, now: NOW, windowComplete: true }
    );
    assert.equal(summary.rawConditions.NM.saleCount, 1);
    assert.equal(summary.rawConditions.NM.latestSale?.soldPrice, 400);
    assert.equal(summary.rawConditions.NM.quality.excluded, 1);
  });

  it("does not fuzzy-dedupe different listing ids with the same title and price", () => {
    const evaluated = evaluateCompQuality(
      [
        comp({ externalId: "one", title: "Charizard #4", soldPrice: 400 }),
        comp({ externalId: "two", title: "Charizard #4", soldPrice: 400 }),
      ],
      charizard
    );
    assert.equal(evaluated.every((item) => item.disposition === "included"), true);
  });

  it("warns on an extreme price and still keeps the sale", () => {
    const prices = [100, 110, 120, 130, 5000];
    const evaluated = evaluateCompQuality(
      prices.map((soldPrice, index) =>
        comp({
          externalId: `p-${index}`,
          soldPrice,
          title: "Charizard #4",
          condition: "NM",
        })
      ),
      charizard
    );
    const extreme = evaluated.find((item) => item.comp.soldPrice === 5000);
    assert.equal(extreme?.disposition, "warning");
    assert.ok(extreme?.flags.some((flag) => flag.code === "extreme_price" && flag.severity === "warning"));
    assert.equal(extreme?.flags.some((flag) => flag.severity === "exclude"), false);
  });

  it("does not classify statistical outliers when fewer than five sales are present", () => {
    assert.equal(extremePriceBounds([10, 10, 10, 10000]), null);
    const evaluated = evaluateCompQuality(
      [10, 10, 10, 10000].map((soldPrice, index) =>
        comp({ externalId: `t-${index}`, soldPrice, title: "Charizard #4" })
      ),
      charizard
    );
    assert.equal(evaluated.some((item) => item.flags.some((flag) => flag.code === "extreme_price")), false);
    assert.equal(evaluated.find((item) => item.comp.soldPrice === 10000)?.disposition, "included");
  });
});

describe("actionable sold summary", () => {
  it("keeps raw NM and damaged in separate summaries", () => {
    const summary = summarizeSoldComps(
      [
        comp({ externalId: "nm", condition: "Near Mint", soldPrice: 500, title: "Charizard #4" }),
        comp({ externalId: "dmg", condition: "Damaged", soldPrice: 30, title: "Charizard #4" }),
      ],
      { identity: charizard, now: NOW, windowComplete: true }
    );
    assert.equal(summary.rawConditions.NM.saleCount, 1);
    assert.equal(summary.rawConditions.NM.median, null);
    assert.equal(summary.rawConditions.NM.latestSale?.soldPrice, 500);
    assert.equal(summary.rawConditions.DMG.latestSale?.soldPrice, 30);
    assert.equal(summary.rawSelectionRequired, true);
    assert.equal(summary.raw, null);
  });

  it("leaves an excluded comp out of the actionable median and still returns it", () => {
    const comps = [
      comp({ externalId: "clean-a", soldPrice: 100, title: "Charizard #4" }),
      comp({ externalId: "clean-b", soldPrice: 300, title: "Charizard #4" }),
      comp({ externalId: "lot", soldPrice: 1, title: "Charizard lot #4" }),
    ];
    const summary = summarizeSoldComps(comps, { identity: charizard, now: NOW, windowComplete: true });
    assert.equal(summary.rawConditions.NM.median, 200);
    assert.equal(summary.rawConditions.NM.saleCount, 2);
    assert.equal(summary.rawConditions.NM.allObserved.saleCount, 3);
    assert.equal(summary.rawConditions.NM.quality.excluded, 1);
    const evaluated = evaluateCompQuality(comps, charizard);
    assert.equal(evaluated.find((item) => item.comp.externalId === "lot")?.disposition, "excluded");
  });

  it("classifies two clean sales as low evidence", () => {
    const summary = summarizeSoldComps(
      [
        comp({
          externalId: "a",
          gradingCompany: "PSA",
          grade: "10",
          condition: null,
          soldPrice: 110,
          soldAt: "2026-09-16",
          title: "Charizard PSA 10",
        }),
        comp({
          externalId: "b",
          gradingCompany: "PSA",
          grade: "10",
          condition: null,
          soldPrice: 150,
          soldAt: "2026-09-18",
          title: "Charizard PSA 10",
        }),
      ],
      { identity: { ...charizard, variant: "cosmosHolofoil" }, now: NOW, windowComplete: true }
    );
    const bucket = summary.grades.PSA?.["10"];
    assert.equal(bucket?.saleCount, 2);
    assert.equal(bucket?.evidence, "limited");
    assert.equal(bucket?.confidence, "low");
    assert.equal(bucket?.median, 130);
  });

  it("does not let an active listing into the sold summary", () => {
    const listing: MarketplaceListing = {
      dataType: "active_listing",
      marketplace: "ebay",
      listingId: "ask-1",
      title: "Charizard asking price",
      price: 9,
      shipping: null,
      totalPrice: null,
      currency: "USD",
      condition: "NM",
      gradingCompany: null,
      grade: null,
      seller: null,
      imageUrl: null,
      url: "https://example.test/ask",
      listingType: "fixed_price",
      observedAt: "2026-09-20",
    };
    const { included, exclusions } = usdSoldComps(
      [comp({ soldPrice: 100, title: "Charizard #4" }), listing as unknown as SoldComp],
      NOW
    );
    assert.equal(exclusions.notSoldComp, 1);
    const summary = summarizeSoldComps(included, { identity: charizard, now: NOW, windowComplete: true });
    assert.equal(summary.rawConditions.NM.latestSale?.soldPrice, 100);
    assert.equal(summary.rawConditions.NM.allObserved.saleCount, 1);
  });

  it("excludes a title that names a different variant from the actionable median", () => {
    const summary = summarizeSoldComps(
      [
        comp({ externalId: "clean", soldPrice: 500, title: "Charizard #4" }),
        comp({ externalId: "first", soldPrice: 9000, title: "1st Edition Charizard #4" }),
      ],
      { identity: charizard, now: NOW, windowComplete: true }
    );
    assert.equal(summary.rawConditions.NM.saleCount, 1);
    assert.equal(summary.rawConditions.NM.latestSale?.soldPrice, 500);
    assert.equal(summary.rawConditions.NM.quality.excluded, 1);
  });

  it("rates five tight sales as moderate, fifteen as strong, and drops a capped or wide bucket", () => {
    const prices = (count: number, soldPriceAt: (index: number) => number, soldAt = "2026-09-20") =>
      Array.from({ length: count }, (_, index) =>
        comp({
          externalId: `c-${index}`,
          soldPrice: soldPriceAt(index),
          soldAt,
          title: "Charizard #4",
          condition: "NM",
        })
      );
    const five = summarizeSoldComps(
      prices(5, (index) => 100 + index * 2),
      { identity: charizard, now: NOW, windowComplete: true }
    );
    assert.equal(five.rawConditions.NM.confidence, "moderate");

    const fifteen = summarizeSoldComps(
      prices(15, (index) => 100 + index),
      { identity: charizard, now: NOW, windowComplete: true }
    );
    assert.equal(fifteen.rawConditions.NM.confidence, "strong");

    const capped = summarizeSoldComps(
      prices(15, (index) => 100 + index),
      { identity: charizard, now: NOW, windowComplete: false }
    );
    assert.equal(capped.rawConditions.NM.confidence, "moderate");

    const wide = summarizeSoldComps(
      prices(5, (index) => [100, 110, 120, 130, 400][index] ?? 0),
      { identity: charizard, now: NOW, windowComplete: true }
    );
    assert.equal(wide.rawConditions.NM.median, 120);
    assert.equal(wide.rawConditions.NM.saleCount, 5);
    assert.equal(wide.rawConditions.NM.quality.excluded, 0);
    assert.equal(wide.rawConditions.NM.confidence, "low");
  });
});
