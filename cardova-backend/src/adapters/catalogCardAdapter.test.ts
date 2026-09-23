import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  mapCatalogCardToCard,
  mapCatalogSamplePrices,
  mapCatalogSampleSales,
  type CatalogCardSource,
} from "./catalogCardAdapter.js";

const catalog = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../catalog.json"), "utf8")
) as CatalogCardSource[];

const mahomes = catalog.find((card) => card.id === "mahomes-2017-prizm");
const jeter = catalog.find((card) => card.id === "jeter-1993-sp");
const charizard = catalog.find((card) => card.id === "charizard-base-4");

describe("mapCatalogCardToCard", () => {
  it("maps a sports card without putting grade on the identity", () => {
    assert.ok(mahomes);
    const card = mapCatalogCardToCard(mahomes);

    assert.equal(card.id, "catalog:mahomes-2017-prizm");
    assert.equal(card.source, "catalog");
    assert.equal(card.sourceId, "mahomes-2017-prizm");
    assert.equal(card.name, "Patrick Mahomes");
    assert.equal(card.year, 2017);
    assert.equal(card.manufacturer, "Panini");
    assert.equal(card.setName, "2017 Panini Prizm");
    assert.equal(card.cardNumber, "269");
    assert.equal(card.sport, "Football");
    assert.equal(card.game, null);
    assert.equal(card.rookie, true);
    assert.equal(card.variation, null);
    assert.equal(card.finish, null);
    assert.equal(card.parallel, null);
    assert.equal(card.language, null);
    assert.equal(Object.hasOwn(card, "grade"), false);
    assert.equal(Object.hasOwn(card, "gradingCompany"), false);
    assert.equal(Object.hasOwn(card, "certificationNumber"), false);
  });

  it("does not invent a manufacturer when the set brand is unknown", () => {
    assert.ok(jeter);
    const card = mapCatalogCardToCard(jeter);
    assert.equal(card.year, 1993);
    assert.equal(card.manufacturer, null);
    assert.equal(card.setName, "1993 SP Foil");
    assert.equal(card.sport, "Baseball");
  });

  it("maps a sample TCG card's finish without a grade", () => {
    assert.ok(charizard);
    const card = mapCatalogCardToCard(charizard);
    assert.equal(card.game, "Pokemon");
    assert.equal(card.sport, null);
    assert.equal(card.finish, "Holo");
    assert.equal(card.year, null);
    assert.equal(card.rookie, null);
    assert.equal(Object.hasOwn(card, "grade"), false);
  });

  it("maps every catalog card to a source-prefixed id", () => {
    assert.equal(catalog.length, 12);
    for (const source of catalog) {
      const card = mapCatalogCardToCard(source);
      assert.equal(card.id, `catalog:${source.id}`);
      assert.equal(card.source, "catalog");
      assert.equal(Object.hasOwn(card, "grade"), false);
    }
  });
});

describe("catalog sample market data", () => {
  it("keeps authored sample prices and drops formula grade ids", () => {
    assert.ok(mahomes);
    const prices = mapCatalogSamplePrices({
      ...mahomes,
      grades: [
        ...(mahomes.grades ?? []),
        { id: "g95", label: "9.5", price: 1 },
        { id: "cgc10", label: "CGC 10", price: 2 },
      ],
    });

    assert.deepEqual(
      prices.map((price) => price.label),
      ["Ungraded", "PSA 10", "BGS 10", "CGC 10"]
    );
    assert.ok(prices.every((price) => price.dataType === "sample"));
    assert.equal(prices.some((price) => price.label === "9.5"), false);
  });

  it("maps catalog sales as sample records with no eBay source", () => {
    assert.ok(mahomes);
    const sales = mapCatalogSampleSales(mahomes);
    assert.equal(sales.length, mahomes.sales?.length);
    for (const sale of sales) {
      assert.equal(sale.dataType, "sample");
      assert.equal(Object.hasOwn(sale, "source"), false);
      assert.equal(Object.hasOwn(sale, "marketplace"), false);
    }
  });
});
