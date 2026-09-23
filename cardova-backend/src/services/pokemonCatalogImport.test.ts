import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ScrydexPokemonCardsPage } from "../providers/scrydex/scrydexPokemonCatalog.js";
import { importEnglishPokemonCards } from "./pokemonCatalogImport.js";

const charizard = {
  id: "base1-4",
  name: "Charizard",
  number: "4",
  language: "English",
  language_code: "EN",
  expansion: { id: "base1", name: "Base", series: "Base", release_date: "1999/01/09" },
  images: [{ type: "front", small: "https://images.scrydex.com/pokemon/base1-4/small", large: "https://images.scrydex.com/pokemon/base1-4/large" }],
};

describe("importEnglishPokemonCards", () => {
  it("continues until every page is imported", async () => {
    const pages: ScrydexPokemonCardsPage[] = [
      { data: [charizard], page: 1, pageSize: 1, count: 1, totalCount: 2 },
      {
        data: [{ ...charizard, id: "base1-2", name: "Blastoise", number: "2" }],
        page: 2,
        pageSize: 1,
        count: 1,
        totalCount: 2,
      },
    ];
    const requested: number[] = [];
    const ids: string[] = [];

    const stats = await importEnglishPokemonCards({
      async fetchPage(page) {
        requested.push(page);
        const next = pages[page - 1];
        if (!next) throw new Error("page was requested past the end");
        return next;
      },
      async upsert(record) {
        ids.push(record.apiId);
        return "inserted";
      },
    });

    assert.deepEqual(requested, [1, 2]);
    assert.deepEqual(ids, ["base1-4", "base1-2"]);
    assert.equal(stats.pages, 2);
    assert.equal(stats.received, 2);
    assert.equal(stats.inserted, 2);
    assert.equal(stats.failed, 0);
  });
});
