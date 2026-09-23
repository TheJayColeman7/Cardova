import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapCatalogSampleSales } from "../adapters/catalogCardAdapter.js";
import { activeListingsResponse, emptySoldComps, isActiveListing, isSoldComp } from "./market.js";

describe("market data types", () => {
  it("does not treat sample sales as sold comps", () => {
    const [sale] = mapCatalogSampleSales({
      id: "example",
      name: "Example",
      sales: [
        {
          date: "2026-01-01",
          title: "Example sale",
          price: 10,
          gradeId: "psa10",
          source: "eBay",
        },
      ],
    });

    assert.ok(sale);
    assert.equal(sale.dataType, "sample");
    assert.equal(isSoldComp(sale), false);
    assert.equal(isActiveListing(sale), false);
    assert.equal(Object.hasOwn(sale, "source"), false);
  });

  it("keeps sold comps empty on an active-listing response", () => {
    const response = activeListingsResponse({
      listings: [],
      live: true,
    });

    assert.deepEqual(response.soldComps, []);
    assert.deepEqual(emptySoldComps(), []);
    assert.notEqual(emptySoldComps(), emptySoldComps());
  });
});
