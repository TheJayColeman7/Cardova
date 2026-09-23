import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { CatalogCardSource } from "../adapters/catalogCardAdapter.js";
import type { PokemonCardSource } from "../adapters/pokemonCardAdapter.js";
import { isSoldComp } from "../domain/market.js";
import { buildActiveListingQuery, createCardService, type PokemonCatalogPort } from "./cardService.js";

const catalog = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../catalog.json"), "utf8")
) as CatalogCardSource[];

const pokemonCharizard: PokemonCardSource = {
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

function pokemonCatalog(overrides: Partial<PokemonCatalogPort> = {}): PokemonCatalogPort & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async searchByName(name) {
      calls.push(`search:${name}`);
      if (name.toLowerCase().includes("charizard")) return [pokemonCharizard];
      return [];
    },
    async getById(id) {
      calls.push(`get:${id}`);
      if (id === "base1-4") return pokemonCharizard;
      return null;
    },
    ...overrides,
  };
}

describe("card service identity", () => {
  it("distinguishes catalog ids, legacy slugs, and pokemon api ids", async () => {
    const pokemon = pokemonCatalog();
    const service = createCardService({ catalog, pokemon });

    const prefixed = await service.getCard("catalog:mahomes-2017-prizm");
    const legacy = await service.getCard("mahomes-2017-prizm");
    const pokemonCard = await service.getCard("pokemon:base1-4");
    const legacyPokemon = await service.getCard("base1-4");
    const wrongSource = await service.getCard("catalog:base1-4");

    assert.equal(prefixed?.id, "catalog:mahomes-2017-prizm");
    assert.equal(prefixed?.source, "catalog");
    assert.equal(legacy?.id, prefixed?.id);
    assert.equal(pokemonCard?.id, "pokemon:base1-4");
    assert.equal(pokemonCard?.source, "pokemon");
    assert.equal(legacyPokemon?.id, "pokemon:base1-4");
    assert.equal(wrongSource, null);
    assert.equal(pokemon.calls.includes("get:base1-4"), true);
    assert.equal(pokemon.calls.includes("get:mahomes-2017-prizm"), false);
  });

  it("does not query pokemon when the search text is empty", async () => {
    const pokemon = pokemonCatalog();
    const service = createCardService({ catalog, pokemon });
    const result = await service.searchCards({ q: "" });

    assert.equal(result.results.length, catalog.length);
    assert.deepEqual(pokemon.calls, []);
  });

  it("returns both sources for a shared name without merging their ids", async () => {
    const service = createCardService({ catalog, pokemon: pokemonCatalog() });
    const result = await service.searchCards({ q: "Charizard" });
    const ids = result.results.map((item) => item.card.id);

    assert.ok(ids.includes("catalog:charizard-base-4"));
    assert.ok(ids.includes("pokemon:base1-4"));
  });
});

describe("card service market data", () => {
  it("keeps one card identity and puts sample prices beside empty sold comps", async () => {
    const service = createCardService({ catalog, pokemon: pokemonCatalog() });
    const detail = await service.getCardDetail("mahomes-2017-prizm");
    const source = catalog.find((card) => card.id === "mahomes-2017-prizm");

    assert.ok(detail);
    assert.ok(source);
    assert.equal(detail.card.id, "catalog:mahomes-2017-prizm");
    assert.equal(Object.hasOwn(detail.card, "grade"), false);
    assert.deepEqual(
      detail.samplePrices.map((price) => price.label),
      ["Ungraded", "PSA 10", "BGS 10"]
    );
    assert.ok(detail.samplePrices.every((price) => price.dataType === "sample"));
    assert.equal(detail.sampleSales.length, source.sales?.length);
    assert.ok(detail.sampleSales.every((sale) => sale.dataType === "sample" && isSoldComp(sale) === false));
    assert.deepEqual(detail.soldComps, []);
  });

  it("returns no sample prices or sold comps for a pokemon card", async () => {
    const service = createCardService({ catalog, pokemon: pokemonCatalog() });
    const detail = await service.getCardDetail("pokemon:base1-4");

    assert.ok(detail);
    assert.deepEqual(detail.samplePrices, []);
    assert.deepEqual(detail.sampleSales, []);
    assert.deepEqual(detail.soldComps, []);
  });

  it("builds the same eBay query string the catalog route used to build", async () => {
    const service = createCardService({ catalog, pokemon: pokemonCatalog() });
    const card = await service.getCard("mahomes-2017-prizm");
    assert.ok(card);
    assert.equal(buildActiveListingQuery(card), "Patrick Mahomes 2017 Panini Prizm 269");
  });

  it("still returns catalog results when the pokemon catalog throws", async () => {
    const service = createCardService({
      catalog,
      pokemon: {
        async searchByName() {
          throw new Error("database down");
        },
        async getById() {
          throw new Error("database down");
        },
      },
    });

    const result = await service.searchCards({ q: "Mahomes" });
    assert.equal(result.results.length, 1);
    assert.equal(result.results[0]?.card.source, "catalog");
    assert.equal(await service.getCard("not-a-card"), null);
  });
});
