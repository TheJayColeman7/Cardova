# Foundation Milestone 1

Date: 2026-09-23.

This milestone gives Sweet Home Cards one card identity and separates sample prices, active eBay listings, and sold comps. It does not add recognition, grading, image upload, seller OAuth, or listing creation.

## What changed

Search, card detail, and eBay listings now go through a card service. Both `catalog.json` and `pokemon_cards` rows can become the same `Card` shape. Grade is not part of that identity.

`server.js` no longer runs `expandCard` or `NUMERIC_GRADES`. Formula CGC, TAG, and numeric grades are not created. Catalog prices and the hand-written sales rows stay on screen only as `dataType: "sample"`. They are not sold comps and they are not labeled as eBay sales.

Live eBay Browse results are `dataType: "active_listing"`. `soldComps` is always an empty array. Asking prices are not averaged into a card value. Grade is not parsed out of listing titles, so a raw listing and a PSA 10 listing are not collapsed into one number.

The duplicate `useEffect` in `EbayListings.jsx` is gone. The card page requests listings once.

## Normalized Card

Defined in `cardova-backend/src/domain/card.ts`.

| Field | Role |
| --- | --- |
| `id` | Canonical id, `{source}:{sourceId}` |
| `source` | `catalog` or `pokemon` |
| `sourceId` | Id in the original source |
| `game` | `Pokemon` for Pokémon rows and for sample cards whose set name contains “Pokemon”. Otherwise null. |
| `sport` | `Football`, `Baseball`, or `Basketball` for sample sports cards. Otherwise null. |
| `name` | Player or card name |
| `year` | Leading year in a catalog set string, or the year of a Pokémon release date |
| `manufacturer` | Catalog only, and only when the text after the year starts with a known brand: Upper Deck, Panini, Donruss, Playoff, Topps, Fleer |
| `setId` | Pokémon set id. Null for catalog cards. |
| `setName` | Set display name. Catalog keeps the original string, including the year. |
| `series` | Pokémon series. Extra field beyond the sketch, because `series_name` is not a subset. |
| `subset` | Null for both current sources |
| `cardNumber` | Collector number |
| `parallel` | Null for both current sources |
| `variation` | Catalog text that is not simply “Rookie” or “Holo”. “Rookie Ticket” is kept here. |
| `rarity` | Pokémon rarity. Null for catalog cards. |
| `finish` | `Holo` when the catalog variant is Holo. Not inferred from Pokémon rarity. |
| `language` | Null. Neither source stores a language. |
| `rookie` | `true` when the catalog variant is Rookie or Rookie Ticket. Otherwise null, not false. |
| `firstEdition` | Null for both current sources |
| `imageSmallUrl`, `imageLargeUrl` | Remote or catalog image URL. Catalog files are not invented here. |

There is no `grade`, `gradingCompany`, or certification number on `Card`.

`1993 SP Foil` keeps year `1993` and manufacturer `null`. “SP” is not guessed.

## ID strategy

| Id the caller sends | Resolution |
| --- | --- |
| `catalog:mahomes-2017-prizm` | That catalog card only |
| `mahomes-2017-prizm` | Legacy catalog slug. Same card. |
| `pokemon:base1-4` | Pokémon row with `api_id` `base1-4` |
| `base1-4` | Catalog first, then Pokémon `api_id` or numeric id |

`catalog:base1-4` does not fall through to Pokémon. A legacy slug that exists in `catalog.json` does not fall through either.

New links use the canonical id. Old `/card/mahomes-2017-prizm` bookmarks still resolve. Saved cards from before this change match on `sourceId` as well as `id`.

## Source adapters

| Function | File | Input |
| --- | --- | --- |
| `mapCatalogCardToCard` | `src/adapters/catalogCardAdapter.ts` | One `catalog.json` object |
| `mapCatalogSamplePrices` / `mapCatalogSampleSales` | same | Authored grades and sales only |
| `mapPokemonCardToCard` | `src/adapters/pokemonCardAdapter.ts` | Pokémon list/detail fields |
| `mapEbayItemSummary` | `src/adapters/ebayListingAdapter.ts` | The Browse fields we read, not the raw response |

`mapCatalogSamplePrices` reads prices that are already on the card. It understands `raw` and ids like `psa10` or `bgs10`. It ignores formula ids such as `g95`. It does not multiply a PSA 10 price to invent another grade.

Sample sales drop the old `source: "eBay"` field.

The `marketplaces` array in `catalog.json` is still in the file and is not mapped. Those numbers are not listings and not comps.

## Card service

`createCardService` in `src/services/cardService.ts`.

- `searchCards` filters the sample catalog in memory. If the query text is non-empty, it also asks the Pokémon port for up to 25 name matches, then applies the same set, category, and variations filters.
- An empty query does not hit PostgreSQL. That keeps the unfiltered demo on the 12 sample cards.
- If the Pokémon lookup throws, catalog results are still returned.
- `getCard` / `getCardDetail` load one identity from either source.
- `getCardDetail(...).soldComps` is always `[]`.
- `buildActiveListingQuery` is `name + setName + cardNumber`. For Mahomes that is still `Patrick Mahomes 2017 Panini Prizm 269`.

Routes in `server.js` call this service. They no longer contain grade math or search rules.

`/api/pokemon/cards` is unchanged. It is the legacy Pokémon DTO. The card page does not use it. Open a Pokémon card with `/api/cards/pokemon:{api_id}` or `/card/pokemon:{api_id}`.

## Market types

`cardova-backend/src/domain/market.ts`.

| Type | `dataType` | Used now |
| --- | --- | --- |
| `SamplePrice`, `SampleSale` | `sample` | Catalog grades and the hand-written sales rows |
| `MarketplaceListing` | `active_listing` | eBay Browse summaries |
| `SoldComp` | `sold_comp` | Type only. Responses use an empty array. |
| `PriceGuideValue` | `price_guide` | Type only. Nothing emits one yet. |

`isSoldComp` is false for sample rows. `totalPrice` on a listing is set only when both item price and shipping are present. Missing shipping stays null. It is not copied from the item price.

Listing type is our own `fixed_price`, `auction`, or `best_offer`. Unknown eBay buying options are dropped. `gradingCompany` and `grade` on a listing are null.

## API contract

`GET /api/cards`

```json
{
  "query": "Mahomes",
  "results": [{ "card": {}, "samplePrices": [] }],
  "sets": []
}
```

`GET /api/cards/:id`

```json
{
  "card": {},
  "samplePrices": [],
  "sampleSales": [],
  "soldComps": []
}
```

`GET /api/cards/:id/listings`

```json
{
  "listings": [],
  "soldComps": [],
  "live": true
}
```

Error bodies still use `reason`, `status`, `stage`, and `message` when eBay fails. `soldComps` is still `[]`.

Query parameters `q`, `sort`, `set`, `category`, and `variants` are unchanged. Sort by price uses the sample PSA 10 price when one exists. Cards without that sample price sort last. That sort is not a market value.

An explicit Pokémon id returns 503 with `{ "error": "Card catalog is not available." }` when PostgreSQL cannot be reached, including a client that rejects an empty password. A legacy id that is not in the sample catalog returns 404 in that same situation, so a typo does not look like an outage. Text search still returns sample-catalog hits if Pokémon is down.

## UI

The card page shows three separate blocks: eBay listings for sale, “Sold comps are not available yet.”, and sample prices / sample records. Grade chips are only the authored sample grades. Home and search copy no longer say those numbers are recent sales.

Shipping is shown on a listing only when eBay sent a shipping amount.

## Tests

`npm test` in `cardova-backend` uses Node’s test runner through `tsx`. No new test package was installed.

21 tests cover:

- Catalog card → `Card`, including unknown manufacturer and Holo finish
- Every catalog card gets a `catalog:` id and no grade field
- Formula grade ids are ignored; sample sales have no eBay source
- Pokémon row → `Card`
- Browse summary → `active_listing`, with null delivered cost when shipping is missing
- Sample rows fail the sold-comp check
- Active-listing responses keep `soldComps` empty
- Service distinguishes `catalog:`, legacy slugs, and `pokemon:` ids
- Empty search does not call Pokémon
- Charizard can return both sources under different ids
- Detail for a sample card has one identity, sample prices, and no sold comps
- The Mahomes eBay query string is unchanged
- Catalog search still returns when the Pokémon port throws
- Empty-password database errors count as unavailable

Also run: `npx tsc --noEmit` in `cardova-backend`, `npm run lint` and `npm run build` in `cardova`. All succeeded.

Checked in the browser against the local Vite app: search “Mahomes”, open the result at `/card/catalog:mahomes-2017-prizm`, confirm sample prices (Ungraded, PSA 10, BGS 10 only), the sold-comps empty state, and live eBay asks with shipping. A direct listings call returned 8 `active_listing` rows and `soldComps: []`.

The API process started during that check was launched before the empty-password failure was classified as 503. Restart the API to pick that up. Until then, an explicit Pokémon id can still respond with 500 while the database password is empty. The response body does not include the driver message.

## Files

New:

- `cardova-backend/src/domain/card.ts`
- `cardova-backend/src/domain/market.ts`
- `cardova-backend/src/domain/market.test.ts`
- `cardova-backend/src/adapters/catalogCardAdapter.ts`
- `cardova-backend/src/adapters/catalogCardAdapter.test.ts`
- `cardova-backend/src/adapters/pokemonCardAdapter.ts`
- `cardova-backend/src/adapters/pokemonCardAdapter.test.ts`
- `cardova-backend/src/adapters/ebayListingAdapter.ts`
- `cardova-backend/src/adapters/ebayListingAdapter.test.ts`
- `cardova-backend/src/services/cardService.ts`
- `cardova-backend/src/services/cardService.test.ts`
- `cardova-backend/src/utils/databaseUnavailable.ts`
- `cardova-backend/src/utils/databaseUnavailable.test.ts`
- `cardova/src/lib/cards.js`

Updated:

- `cardova-backend/server.js`
- `cardova-backend/ebay.js`
- `cardova-backend/package.json`
- `cardova/src/pages/Home.jsx`
- `cardova/src/pages/SearchResults.jsx`
- `cardova/src/pages/CardDetail.jsx`
- `cardova/src/pages/Collection.jsx`
- `cardova/src/components/EbayListings.jsx`
- `cardova/src/components/SearchResultRow.jsx`
- `cardova/src/components/CardThumb.jsx`
- `cardova/src/components/AddToCardsButton.jsx`
- `cardova/src/lib/collection.js`
- `docs/SWEET_HOME_CARDS_AUDIT.md` (pointer only)

Not removed: `catalog.json`, the Pokémon table, or `/api/pokemon/cards`.

## Remaining technical debt

- Two stores still exist. They now share a mapping, not a table.
- Pokémon finish, parallel, language, and edition are not parsed. A “Rare Holo” stays in `rarity` only, so “include variations” does not treat it as a holo.
- The variations toggle still hides rookies, because the old catalog stored “Rookie” in `variant`.
- eBay results are still an unfiltered name/set/number search. Graded and raw asks sit in one strip. They are not turned into a value, and they are not labeled with a grade.
- Sample sales are still demo copy. They are isolated, not deleted.
- Price sort uses sample PSA 10 prices.
- Pokémon search is capped at 25 and only runs when there is query text.
- Accounts, images, and sold comps are still absent.
- `/api/pokemon/cards` still returns the old DTO.

## Product-owner decisions still open

- Is `catalog:` / `pokemon:` the public id, or should the URL hide the source?
- Should a text search merge Pokémon hits with the 12-card sample, or should one catalog win?
- Which brands may be parsed from set titles, and is “SP” a manufacturer?
- Should “Rookie” keep hiding a card when variations are turned off?
- Should Pokémon rarity text such as “Rare Holo” fill `finish`?
- Which sold-comp provider is allowed to populate `SoldComp`? Until that choice, the list stays empty.
- Should active eBay asks be filtered by grade later, or shown mixed with grade left unknown?
- Is the legacy `/api/pokemon` response still required?
