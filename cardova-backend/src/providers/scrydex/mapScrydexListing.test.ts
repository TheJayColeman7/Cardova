import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isActiveListing, isSoldComp } from "../../domain/market.js";
import { mapScrydexListing } from "./mapScrydexListing.js";

describe("mapScrydexListing", () => {
  it("maps a historical listing to a sold comp without copying a new card identity", () => {
    const comp = mapScrydexListing(
      {
        id: "6d690f4c-e467-432a-9735-2ecc493ba012",
        source: "ebay",
        card_id: "base1-4",
        title: "Charizard PSA 10",
        variant: "unlimitedHolofoil",
        company: "PSA",
        grade: "10",
        is_perfect: false,
        is_error: false,
        is_signed: true,
        url: "https://www.ebay.com/itm/306453556017",
        price: 2399,
        currency: "USD",
        sold_at: "2026/09/01",
        condition: "NM",
      },
      "pokemon:base1-4"
    );
    assert.ok(comp);
    assert.equal(isSoldComp(comp), true);
    assert.equal(isActiveListing(comp), false);
    assert.equal(comp?.cardId, "pokemon:base1-4");
    assert.notEqual(comp?.cardId, "base1-4");
    assert.equal(comp?.externalId, "6d690f4c-e467-432a-9735-2ecc493ba012");
    assert.equal(comp?.variant, "unlimitedHolofoil");
    assert.equal(comp?.gradingCompany, "PSA");
    assert.equal(comp?.grade, "10");
    assert.equal(comp?.perfect, false);
    assert.equal(comp?.signed, true);
    assert.equal(comp?.soldAt, "2026-09-01");
    assert.equal(comp?.soldPrice, 2399);
    assert.equal(comp?.url, "https://www.ebay.com/itm/306453556017");
    assert.equal(JSON.stringify(comp).includes("card_id"), false);
  });
});
