import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapPokemonCardToCard, type PokemonCardSource } from "./pokemonCardAdapter.js";

const charizard: PokemonCardSource = {
  apiId: "base1-4",
  cardName: "Charizard",
  cardNumber: "4",
  setId: "base1",
  setName: "Base",
  seriesName: "Base",
  rarity: "Rare Holo",
  imageSmallUrl: "https://images.example/small.png",
  imageLargeUrl: "https://images.example/large.png",
  releaseDate: "1999-01-09",
};

describe("mapPokemonCardToCard", () => {
  it("maps a database card into the shared identity", () => {
    const card = mapPokemonCardToCard(charizard);

    assert.equal(card.id, "pokemon:base1-4");
    assert.equal(card.source, "pokemon");
    assert.equal(card.sourceId, "base1-4");
    assert.equal(card.game, "Pokemon");
    assert.equal(card.sport, null);
    assert.equal(card.name, "Charizard");
    assert.equal(card.year, 1999);
    assert.equal(card.manufacturer, null);
    assert.equal(card.setId, "base1");
    assert.equal(card.setName, "Base");
    assert.equal(card.series, "Base");
    assert.equal(card.subset, null);
    assert.equal(card.cardNumber, "4");
    assert.equal(card.parallel, null);
    assert.equal(card.variation, null);
    assert.equal(card.rarity, "Rare Holo");
    assert.equal(card.finish, null);
    assert.equal(card.language, null);
    assert.equal(card.rookie, null);
    assert.equal(card.firstEdition, null);
    assert.equal(card.imageSmallUrl, "https://images.example/small.png");
    assert.equal(card.imageLargeUrl, "https://images.example/large.png");
    assert.equal(Object.hasOwn(card, "grade"), false);
    assert.equal(Object.hasOwn(card, "gradingCompany"), false);
  });
});
