import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canonicalCardId } from "../domain/card.js";
import { mapPokemonCardToCard } from "../adapters/pokemonCardAdapter.js";
import { mapScrydexPokemonCard } from "./scrydexPokemonCardMapper.js";

const charizard = {
  id: "base1-4",
  name: "Charizard",
  supertype: "Pokémon",
  subtypes: ["Stage 2"],
  types: ["Fire"],
  hp: "120",
  number: "4",
  rarity: "Rare Holo",
  artist: "Mitsuhiro Arita",
  national_pokedex_numbers: [6],
  images: [
    {
      type: "front",
      small: "https://images.scrydex.com/pokemon/base1-4/small",
      medium: "https://images.scrydex.com/pokemon/base1-4/medium",
      large: "https://images.scrydex.com/pokemon/base1-4/large",
    },
  ],
  expansion: {
    id: "base1",
    name: "Base",
    series: "Base",
    language: "English",
    language_code: "EN",
    release_date: "1999/01/09",
  },
  language: "English",
  language_code: "EN",
};

describe("mapScrydexPokemonCard", () => {
  it("keeps the Scrydex id as the catalog api id", () => {
    const record = mapScrydexPokemonCard(charizard);
    assert.equal(record.apiId, "base1-4");
    assert.equal(canonicalCardId("pokemon", record.apiId), "pokemon:base1-4");
    const card = mapPokemonCardToCard(record);
    assert.equal(card.id, "pokemon:base1-4");
    assert.equal(card.sourceId, "base1-4");
    assert.notEqual(card.id, "scrydex:base1-4");
  });

  it("maps expansion, English language, and image URLs", () => {
    const record = mapScrydexPokemonCard(charizard);
    assert.equal(record.setId, "base1");
    assert.equal(record.setName, "Base");
    assert.equal(record.seriesName, "Base");
    assert.equal(record.cardNumber, "4");
    assert.equal(record.rarity, "Rare Holo");
    assert.equal(record.releaseDate, "1999-01-09");
    assert.equal(record.imageSmallUrl, "https://images.scrydex.com/pokemon/base1-4/small");
    assert.equal(record.imageLargeUrl, "https://images.scrydex.com/pokemon/base1-4/large");
    assert.equal(record.rawData.language, "English");
    assert.equal(record.rawData.language_code, "EN");
    assert.equal(JSON.stringify(record.rawData).includes("prices"), false);
  });
});
