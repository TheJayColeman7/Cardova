import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isActiveListing, isSoldComp } from "../domain/market.js";
import { mapEbayItemSummary } from "./ebayListingAdapter.js";

const observedAt = "2026-09-23T15:00:00.000Z";

describe("mapEbayItemSummary", () => {
  it("maps a Browse item summary to an active listing", () => {
    const listing = mapEbayItemSummary(
      {
        itemId: "v1|123|0",
        title: "2017 Prizm Mahomes PSA 10",
        price: { value: "1800.00", currency: "USD" },
        image: { imageUrl: "https://images.example/listing.jpg" },
        itemWebUrl: "https://www.ebay.com/itm/123",
        condition: "Graded",
        seller: { username: "seller-one" },
        buyingOptions: ["FIXED_PRICE", "BEST_OFFER"],
        shippingOptions: [{ shippingCost: { value: "4.95", currency: "USD" } }],
      },
      observedAt
    );

    assert.ok(listing);
    assert.equal(isActiveListing(listing), true);
    assert.equal(isSoldComp(listing), false);
    assert.equal(listing.dataType, "active_listing");
    assert.equal(listing.marketplace, "ebay");
    assert.equal(listing.listingId, "v1|123|0");
    assert.equal(listing.price, 1800);
    assert.equal(listing.shipping, 4.95);
    assert.equal(listing.totalPrice, 1804.95);
    assert.equal(listing.seller, "seller-one");
    assert.equal(listing.imageUrl, "https://images.example/listing.jpg");
    assert.equal(listing.listingType, "fixed_price");
    assert.equal(listing.condition, "Graded");
    assert.equal(listing.gradingCompany, null);
    assert.equal(listing.grade, null);
    assert.equal(listing.observedAt, observedAt);
  });

  it("leaves delivered cost empty when shipping is missing", () => {
    const listing = mapEbayItemSummary(
      {
        title: "Auction lot",
        currentBidPrice: { value: "25.50", currency: "USD" },
        itemWebUrl: "https://www.ebay.com/itm/9",
        buyingOptions: ["AUCTION"],
      },
      observedAt
    );

    assert.ok(listing);
    assert.equal(listing.price, 25.5);
    assert.equal(listing.shipping, null);
    assert.equal(listing.totalPrice, null);
    assert.equal(listing.listingType, "auction");
    assert.equal(listing.gradingCompany, null);
  });

  it("drops summaries that have no listing url", () => {
    assert.equal(mapEbayItemSummary({ title: "Missing url", price: { value: "10" } }, observedAt), null);
  });
});
