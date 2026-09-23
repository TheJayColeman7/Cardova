# Milestone 3: Real Sold Comps + Grade Market Summary V1

Date: 2026-09-23.

This milestone adds recent sold evidence for a confirmed Pokémon card. It does not grade cards, predict grades, convert currency, store scan photos, or create listings.

`price_history` was not added. Scrydex historical listings already include sold price, currency, sold date, variant, grading company, grade, and the listing URL, which is enough for the sold-market UI. `PriceGuideValue` stays unused for a later milestone. A price guide is not written into sold-comp fields.

## Provider architecture

```text
Card Detail
  → GET /api/cards/:id/market
  → market service (90-day window, variant filter, USD summary, TTL cache)
  → SoldCompProvider: fetchScrydexSoldComps
  → GET https://api.scrydex.com/pokemon/v1/cards/{sourceId}/listings
  → mapScrydexListing
  → SoldComp
```

Scrydex field names stay in `cardova-backend/src/providers/scrydex/`. The rest of the app uses `SoldComp`. React never receives the provider JSON.

The provider card id is the existing Pokémon `sourceId`, such as `base1-4`. The public card id stays `pokemon:base1-4`. Catalog sports cards are not sent to this provider. Their market response is `available: false`.

Credentials are the existing server-side `SCRYDEX_API_KEY` and `SCRYDEX_TEAM_ID`. They are not returned, logged, or written into docs.

Active eBay Browse listings stay on `GET /api/cards/:id/listings` with `dataType: "active_listing"`. Card detail still returns `soldComps: []`. Sold evidence lives only on the market endpoint.

## Window and pagination

Each request asks Scrydex for `days=90`, `page_size=100`, and `casing=snake`. There is no `include` and no price-history path.

A single card stops after 5 pages, which is 500 listings. If the provider still has more rows, `windowComplete` is `false`. The UI then says the window is capped and is not every sale on record. A short page or a reached `total_count` sets `windowComplete` to `true`.

A partial window is not treated as lifetime sales history.

## Cache

Successful provider results are kept in process memory for 30 minutes. The key is the canonical card id plus the 90-day window. Variant filtering happens after the cache read, so choosing another variant does not spend another provider call.

Failures are not cached. A failed request does not replace a previous successful record, and it does not invent an empty market.

There is no Redis and no market-history table. Restarting the API clears the cache.

## SoldComp mapping

| SoldComp | Scrydex listing |
| --- | --- |
| `dataType` | always `sold_comp` |
| `cardId` | Sweet Home Cards id passed by the caller, not `card_id` |
| `externalId` | listing `id` |
| `marketplace` | listing `source` when present, otherwise null |
| `source` | `scrydex` |
| `title` | `title` |
| `soldPrice` | finite numeric `price`, otherwise null |
| `currency` | `currency` |
| `soldAt` | `sold_at`, normalized from `YYYY/MM/DD` to `YYYY-MM-DD` |
| `variant` | `variant` |
| `condition` | `condition` only when the provider sends a string |
| `gradingCompany` | `company` |
| `grade` | `grade` |
| `perfect`, `signed`, `error` | `is_perfect`, `is_signed`, `is_error` when those values are booleans |
| `url` | `url` |
| `shipping` | null. The listings payload used here has no shipping field |

Missing values stay null. Flags are not invented as `false`.

## Variants

Every sold comp keeps its provider variant. Named variants are separate markets. Examples seen on Base Charizard: `unlimitedHolofoil`, `firstEditionShadowlessHolofoil`, `unlimitedShadowlessHolofoil`, and `metal`.

If more than one variant is present, summaries stay empty until the user selects one. The UI label is “Select variant”. Sales are not averaged across variants.

If some comps have a variant and some do not, the response also offers `__unspecified__`, shown as “Unspecified variant”. If every comp has no variant, they stay in one market and no selector is shown.

## Buckets

Summaries are deterministic. No model prices them.

- Raw: no grading company and no grade. Condition is kept on each comp. One raw bucket is shown. If every raw comp shares one condition, that condition is labeled. If they differ, the UI says raw sales include more than one condition. Ungraded is not assumed to be Near Mint.
- PSA 8, PSA 9, and PSA 10 are always present. Zero sales stay “No recent sold comps”. Missing grades are not filled from a neighbor.
- Other PSA grades, BGS, CGC, TAG, and any other company the provider sends are separate buckets, shown under “Other grades”.
- A graded comp with a company but no grade is bucketed as `unknown`, not raw. A graded comp with a grade but no company is bucketed as `Unspecified`.

`10.0` is stored as `10`. `9.5` stays `9.5`. PSA 10 and BGS 10 are different buckets.

## Median and evidence

For each USD bucket:

| Sales | Evidence | What is shown |
| --- | --- | --- |
| 0 | `none` | “No recent sold comps”. No median. |
| 1 | `single` | “Last sale” only. Not a market estimate. |
| 2 | `limited` | Median, min, max, and “Limited data”. |
| 3 or more | `summary` | Median, min, max, sale count, and last sale. |

The displayed estimate is the median. An odd count uses the middle sale. An even count averages the two middle sales. Mean is calculated and returned, but it is not the headline.

Min and max stay visible. High and low sales are not deleted. A record is excluded only when it is structurally invalid: not a sold comp, missing or non-positive price, missing sold date, outside the 90-day window, or non-USD. Those counts are returned on `exclusions`. Non-USD comps can still appear in the sold list, and they are not included in the USD median. There is no FX conversion.

## API

`GET /api/cards/:id/market`

Optional `variant` query. Provider failures return a short JSON error: timeout `504`, unexpected body `502`, otherwise `503`. The provider body is not forwarded.

```json
{
  "cardId": "pokemon:base1-4",
  "windowDays": 90,
  "windowComplete": false,
  "available": true,
  "variant": "unlimitedHolofoil",
  "variants": ["firstEditionShadowlessHolofoil", "metal", "unlimitedHolofoil", "unlimitedShadowlessHolofoil"],
  "selectionRequired": false,
  "summaries": {
    "raw": {},
    "grades": { "PSA": { "8": {}, "9": {}, "10": {} } }
  },
  "soldComps": [],
  "exclusions": {},
  "cached": false
}
```

`soldComps` are individual `sold_comp` rows. Active listings are not in this payload. While `selectionRequired` is true, `summaries` is null and `soldComps` is empty.

## UI

Card detail order:

1. Card identity
2. Recent sold market, with a variant selector when needed, Raw / PSA 8 / PSA 9 / PSA 10, and other grades behind “Other grades”
3. Recent sold comps: date, title, grade, sold price, marketplace link
4. For sale on eBay, unchanged, with the existing line that these are cards people are selling right now

Sample price chips remain only when a demo sports card has sample prices, and they stay labeled Sample. Pokémon cards no longer show an empty sample-price block.

Date-only sold dates are formatted as calendar dates in UTC so `2026-09-21` does not shift to the previous local day.

## Automated tests

Scrydex is mocked. The suite does not call the live listings API.

Covered: listing to `SoldComp`; sample and active rows fail the sold-comp guard; raw, PSA 9, PSA 10, and BGS 10 stay apart; variants stay apart until one is selected; a EUR sale is left out of the USD median; odd and even medians; one sale, zero sales, and three sales; a provider error hides the response body; pagination stops at 5 pages; a second request does not call the provider again.

`npm test`: 60 passing. `npx tsc --noEmit` passed. Frontend `npm run lint` and `npm run build` passed.

## Real checks on 2026-09-23

These figures are the most recent 90 days returned by the listings endpoint. They are not all sales ever. Base Charizard hit the 500-listing cap, so its window is incomplete.

### pokemon:base1-4 — Charizard, Base

- Variants: `firstEditionShadowlessHolofoil`, `metal`, `unlimitedHolofoil`, `unlimitedShadowlessHolofoil`
- Cold fetch: 5 requests, 500 comps, `windowComplete: false`, about 1.0–2.0 seconds
- Second request for another variant: cache hit, no second provider call. Over HTTP the first unlimited-holo response was uncached at 1032 ms and the repeat was cached at 44 ms
- Selected variant `unlimitedHolofoil`: 352 comps inside the capped window

| Bucket | Sales | Evidence | Median | Range | Latest |
| --- | ---: | --- | ---: | --- | --- |
| Raw | 22 | summary | $546.02 | $23.99–$14,000.00 | $382.00 on 2026-09-21 |
| PSA 8 | 36 | summary | $1,410.00 | $1,225.00–$1,852.00 | $1,400.00 on 2026-09-22 |
| PSA 9 | 20 | summary | $3,703.50 | $3,097.73–$4,500.00 | $3,705.00 on 2026-09-20 |
| PSA 10 | 3 | summary | $35,000.00 | $8,125.00–$35,000.00 | $35,000.00 on 2026-09-21 |

The $23.99 raw sale and the $8,125 PSA 10 sale were kept. They are why the median is the headline and why min/max stay visible.

Card detail for this id still returned `soldComps: []`. The listings endpoint returned 8 rows, all `active_listing`, and its own `soldComps` array was empty.

The card page was opened in the browser. Before a variant was chosen, the page asked for a variant and did not show a combined median. After `unlimitedHolofoil`, the sold chips, the sold-comp table, and “For sale on eBay” were separate. Asking prices on that page were about $45–$556, which is not the sold median. “Other grades” stayed collapsed. No sample-price block appeared.

The scan page was not exercised again. Recognition did not change in this milestone. The page above is the page a confirmed `pokemon:base1-4` opens.

### pokemon:sv3pt5-1 — Bulbasaur, 151

- Variants: `cosmosHolofoil`, `expansionStamp`, `normal`, `reverseHolofoil`
- Cold fetch: 1 request, 67 comps, `windowComplete: true`, 319 ms
- Second call: cache hit
- Selected variant `cosmosHolofoil`: 2 comps, both PSA 10

| Bucket | Sales | Evidence | Shown |
| --- | ---: | --- | --- |
| Raw | 0 | none | No recent sold comps |
| PSA 8 | 0 | none | No recent sold comps |
| PSA 9 | 0 | none | No recent sold comps |
| PSA 10 | 2 | limited | Median $129.79, range $109.57–$150.00, last sale $150.00 on 2026-09-16. Labeled limited data, not a firm market estimate. |

## Provider requests for one cold card-detail load

Card identity and active eBay listings are separate calls. The new sold-comp cost is the listings pagination only.

- Base Charizard: 5 listings requests, then the page cap. A repeat within 30 minutes is 0.
- 151 Bulbasaur: 1 listings request. A repeat within 30 minutes is 0.

Scrydex did not return a credit count on these responses, so this document does not invent one. Each page is one listings HTTP request.

## Known limitations

- The 500-listing cap can cut off a busy card. `windowComplete: false` is the signal. It is not lifetime history.
- One raw bucket mixes conditions when the provider sends more than one. Graded companies stay separate.
- Variant strings are the provider’s names, such as `unlimitedHolofoil`, not a display label.
- Titles are not re-checked. A provider row can mention another product or language while still being attached to this card and variant. Those rows are kept.
- Non-USD sales are listed and excluded from the USD median. No conversion.
- The cache is per API process and expires after 30 minutes.
- Sports catalog cards have no sold-comp provider yet.
- PSA 10 with only three sales can have a wide range. The median is still shown because the evidence rule is three sales, and the range stays next to it.

## Next recommended milestone

AI pre-grade. Market data now has observed raw and graded sold comps, kept apart from asking prices. A later price-guide milestone should keep `PriceGuideValue` separate from these sold comps.
