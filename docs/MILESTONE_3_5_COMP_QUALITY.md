# Milestone 3.5: Comp Quality + Market Confidence

Date: 2026-09-24.

This milestone adds a deterministic quality check in front of the sold-market summary. It does not grade cards, predict grades, compare a grade with a sale price, or add another price provider.

A row can be included, included with a warning, or excluded for a stated reason. An unusual price is not deleted only because it is high or low. Excluded rows stay in the response.

Evidence labels describe the quality and quantity of the sold rows we have now. They are not a forecast of the next sale.

## Where it runs

```text
USD sold comps inside the selected variant
  → duplicate check on external listing id
  → title and metadata checks against the confirmed card
  → IQR warning inside each bucket, only when that bucket has 5 or more otherwise-valid prices
  → actionable summary (warnings stay in)
  → all-observed summary (excluded rows stay visible, duplicates do not count twice)
```

Structural filters from Milestone 3 still run first: not a sold comp, missing or non-positive price, missing date, outside the 90-day window, or non-USD. Those rows never enter the USD median. Active listings still never enter sold summaries.

Pokémon cards with no language stored are treated as English. This catalog is the English Pokémon catalog. A title that names another language is a contradiction. A title that names no language is not.

## Flags

Each flag has a code, a severity (`warning` or `exclude`), and a reason.

| Code | Severity | When it is raised |
| --- | --- | --- |
| `wrong_language` | exclude | The title names a language other than the confirmed language. |
| `title_set_conflict` | exclude | The title names a different set. For Base / Base Set, that includes “Base Set 2”, “Base Set II”, and “Legendary Collection”. |
| `title_card_number_conflict` | exclude | The title has an explicit `#n`, `n/set-size`, or `No. n`, and none of those numbers match the confirmed card. A missing number is not a conflict. A 1–3 digit number is used so a long PSA cert number is not read as a card number. |
| `title_name_conflict` | exclude | The title says “not {name}”, or it never mentions the confirmed name and the word immediately before “holo” / “holofoil”, or immediately before a collector number, is another name. Stopwords such as “base”, “set”, “unlimited”, “rare”, and “english” do not count. A title that simply omits the name is not a conflict. |
| `variant_conflict` | exclude | The title states a finish or edition the selected variant contradicts: first edition versus unlimited, shadowless versus a variant that is not shadowless, reverse holo versus a non-reverse holo, or holo versus `normal`. A title that says nothing about the variant is not a conflict. |
| `grade_conflict` | exclude | The title names a different grade than the provider grade, or the provider row is ungraded and the title names a numeric grade or says “PSA graded” (or the same form for BGS, CGC, SGC, TAG, ACE, GMA, or HGA). The row is not moved into the title’s grade bucket. |
| `company_conflict` | exclude | The title names a different grading company than the provider company. |
| `lot_or_bundle` | exclude | The title matches a lot pattern below, or it contains two different `#` card numbers. |
| `sealed_product` | exclude | The title names a sealed product: booster box, booster pack, elite trainer box, ETB, sealed box, factory sealed, or sealed product. The word “sealed” alone is not enough. |
| `signed` | exclude | `signed` is true, or the title says signed / autograph / autographed. “Unsigned” does not match. |
| `error_card` | exclude | `error` is true, or the title says misprint, miscut, or error card. |
| `damaged` | warning | The title says damaged, creased, or water damage, and the provider condition is not already Damaged. “No damage” does not match. |
| `extreme_price` | warning | The price is outside the bucket’s IQR fences. It stays in the actionable median. |
| `duplicate_listing` | exclude | The same non-empty `externalId` was already kept. The first copy remains. Different ids are not compared, even when the title and price match. |

Not used as quality flags: `unknown_condition` and `missing_required_metadata`. Missing condition becomes the Unknown raw bucket. Missing price, date, or USD is still the older structural exclusion.

Any exclude flag removes the row from the actionable median. A warning does not. The headline median is the actionable median.

## Lot patterns

Excluded when the title matches any of these, case-insensitive:

- `mixed lot`, `lot of`, `card lot`
- `lot` or `lots` as a whole word, except the phrase “a lot”
- `bundle`
- `set of` followed by a number
- `playset`
- `multiple cards`
- a quantity of 2 or more followed by `cards`, such as `2 cards`
- a quantity of 2 or more in `2x` or `x2` form
- `entire collection`, `card collection`, or `collection of`
- two different `#` numbers in one title

“Base Set” does not match “set of”. “From my collection” does not match. “4x6” does not match `x2`, because the quantity has to end on a word boundary.

## Raw condition

Provider condition is mapped only from an explicit value:

| Provider text | Bucket |
| --- | --- |
| NM, Near Mint, Mint | NM |
| LP, Lightly Played | LP |
| MP, Moderately Played | MP |
| HP, Heavily Played | HP |
| DMG, Damaged, Poor | DMG |
| blank or anything else | Unknown |

Near Mint is not inferred from the absence of a grade.

Each of those six buckets has its own median, range, count, and evidence label. NM and Damaged are never averaged together.

The headline `raw` value is one of those buckets only when a single condition has actionable sales, or when one condition has at least 3 actionable sales and at least 80% of the actionable raw sales. Otherwise `raw` is null, `rawSelectionRequired` is true, and the client shows the condition rows separately.

## Extreme prices

Fences are calculated only when a bucket has at least 5 prices that are not already excluded.

Sort the prices. Q1 and Q3 are linear interpolations at 25% and 75% of the sorted index. IQR is Q3 − Q1. The fences are Q1 − 1.5 × IQR and Q3 + 1.5 × IQR. A price strictly outside either fence gets `extreme_price` with severity warning.

Fewer than 5 prices: no statistical flag, even if one price is far away.

The warned price stays in the actionable count, median, and range. It leaves the actionable summary only when another exclude flag is also present.

`allObserved` is the same bucket after duplicate removal, including excluded rows. Its median can differ from the headline median.

## Evidence

`confidence` is separate from the older display `evidence` (`none`, `single`, `limited`, `summary`). Display evidence still decides whether the chip shows a last sale or a median. `confidence` is the evidence label.

Start from the actionable sale count:

| Actionable sales | Starting label |
| --- | --- |
| 0 | `none` |
| 1 | `very_low` |
| 2–4 | `low` |
| 5–14 | `moderate` |
| 15 or more | `strong` |

For 5 or more sales, each of these drops the label one step. It does not fall below `low`.

- The 90-day window is incomplete.
- Warnings are at least 25% of the actionable sales in that bucket.
- The actionable range is wider than 0.75 × the median.
- The newest actionable sale is more than 60 days old.

Two clean sales stay `low`. They do not become `strong`.

## API

`GET /api/cards/:id/market` keeps `sold_comp`, `active_listing`, `sample`, and `price_guide` distinct.

Added on the response:

```json
{
  "quality": {
    "included": 18,
    "warned": 2,
    "excluded": 3,
    "exclusionReasons": [{ "code": "lot_or_bundle", "count": 1, "reason": "Listing title indicates multiple cards" }]
  }
}
```

Each returned sold comp has `quality.disposition` and `quality.flags`. Non-USD rows stay in the list with an empty flag list and disposition `excluded`; they are counted in `exclusions.nonUsd`, not in `quality`.

Each summary bucket adds `confidence`, `quality` (`included`, `warned`, `excluded`), and `allObserved` (`saleCount`, `minimum`, `maximum`, `median`, `mean`). `saleCount`, `median`, `minimum`, and `maximum` on the bucket are the actionable figures.

Summaries also add `rawConditions` for NM, LP, MP, HP, DMG, and Unknown, plus `rawSelectionRequired`. `summaries.raw` is the headline raw bucket, or null when the user must read the condition rows separately.

## UI

On card detail, each sold bucket shows the median or last sale, the sale count, the range, and the evidence label. Raw chips are labeled with the condition, including Unknown. A bucket with warned rows says “Includes flagged sales”.

If more than one raw condition has sales and none dominates, the page says the conditions are not combined into one raw price.

“Comp quality” is collapsed by default. It shows included, flagged, and excluded counts, the exclusion reasons, and the flagged or excluded rows with the reason text. The full sold table is unchanged.

## Tests

Scrydex is mocked. The suite does not call the live listings API. `npm test`: 78 passing. `npx tsc --noEmit` passed. Frontend `npm run lint` and `npm run build` passed.

Covered:

- an explicit Base Set 2 title is excluded
- an explicit Japanese title is excluded for an English card
- a different card name in front of “holo” is excluded even when `4/102` matches
- “PSA graded” on an ungraded row is excluded
- a missing set name is not by itself an exclusion
- “from my collection” is not a lot
- a repeated external id is deduped and does not enter the median twice
- identical title and price with different ids are both kept
- an extreme price in a sample of 5 is a warning and stays in the median
- a sample of 4 does not get an IQR flag
- NM and Damaged stay in separate raw buckets
- an excluded lot does not move the actionable median and remains in the evaluated rows
- two clean sales are `low`, five tight sales are `moderate`, fifteen are `strong`, an incomplete window drops strong to moderate, and a wide range drops moderate to low
- an active listing does not enter the sold summary
- a first-edition title is excluded from the unlimited actionable median
- variants stay on separate markets until one is selected
- a contradictory row remains on the market response and out of the actionable median

## Live check on 2026-09-24

`pokemon:base1-4`, variant `unlimitedHolofoil`. The provider window is still capped at 500 listings, so `windowComplete` is false. Counts below are that capped window, not every sale on record. The confirmed card is Charizard, Base, #4, English.

| Listing | What the title says | Result |
| --- | --- | --- |
| $23.99 on 2026-09-09 | “Pokemon TCG Charizard 4/102 Base Set English Holo Rare Stage 2 120 HP”. No company, grade, or condition. | Included. The title matches this English Base Set holo. The provider did not send a condition, so it sits in Unknown. With 17 actionable raw sales it is inside the IQR fences, so it is not an extreme-price warning. It remains the low end of the actionable range. |
| $14,000 on 2026-09-12 | “Wizards of the Coast Charizard Base Set Holo Rare 4/102 1999 EN PSA Graded”. Provider company and grade are empty. | Excluded, `grade_conflict`. The title says the card is PSA graded. It is not treated as a raw sale, and it is not reassigned to a PSA grade. |
| $8,125 on 2026-09-12 | “Pokemon TCG 2010 HGSS Triumphant Drapion Holo Rare 4/102 PSA 10”. Provider says PSA 10. | Excluded, `title_name_conflict`. The title names Drapion from Triumphant. `4/102` happens to match Charizard’s number and is not treated as proof. |
| $35,000 on 2026-09-21 | “Pokemon 1999 Charizard Base Set Unlimited Holo Rare #4 PSA 10 Gem Mint”. | Included. No quality flags. |
| $35,000 on 2026-09-08 | “1999 Pokemon Charizard Base Set Unlimited Holo Rare #4 PSA 10 Gem Mint”. | Included. No quality flags. |

Variant-level quality for this selection: 315 included, 16 flagged, 23 excluded. The largest exclusion reasons were wrong language (7), company conflict (6), grade conflict (4), and card-number conflict (3).

The provider did not send a raw condition on these Charizard sales, so every remaining raw row is Unknown. That is the headline raw bucket. It is not labeled Near Mint.

| Bucket | Actionable sales | Evidence | Median | Actionable range | Latest actionable sale |
| --- | ---: | --- | ---: | --- | --- |
| Raw · Unknown | 17 | low | $542.04 | $23.99–$1,600.00 | $410.00 on 2026-09-22 |
| PSA 8 | 33 | moderate | $1,400.00 | $1,236.97–$1,852.00 | $1,400.00 on 2026-09-22 |
| PSA 9 | 21 | moderate | $3,600.00 | $3,097.73–$4,500.00 | $3,475.00 on 2026-09-22 |
| PSA 10 | 2 | low | $35,000.00 | $35,000.00–$35,000.00 | $35,000.00 on 2026-09-21 |

Raw evidence is low because the window is capped and the actionable range is still wide. One of those raw sales is an extreme-price warning and stays inside the $23.99–$1,600 range. The observed raw range, which still includes the excluded $14,000 sale, is $23.99–$14,000.00.

PSA 10 evidence is low because only two sales passed. The observed PSA 10 range, including the excluded Drapion, is still $8,125.00–$35,000.00. The headline does not use $8,125.

PSA 8 and PSA 9 are moderate rather than strong because this card’s window is incomplete.

### pokemon:sv3pt5-1 — Bulbasaur, 151, `cosmosHolofoil`

The window is complete. Both provider rows are PSA 10. One title is the Costco cosmos promo holo and is included at $150.00 on 2026-09-16. The other title says “Cosmos Reverse Holo” and is excluded as a variant conflict; that sale was $109.57 on 2026-07-09.

The actionable PSA 10 figure is the last sale, $150.00, with evidence `very_low`. There is no median. The observed pair is still available and its median would be $129.79, but that figure is not the headline. Raw, PSA 8, and PSA 9 have no sales. This is not presented as a firm PSA 10 value.

## Known limitations

- The name check only fires when the confirmed name is missing and another word sits directly before “holo” / “holofoil” or before a collector number. A contradictory name in a different position can pass.
- “Base Set 2” and “Legendary Collection” are explicit set conflicts for Base. Other reprint names are not in that list unless the title also trips the name or number check.
- IQR will not flag a low price when the fences are wide. The $23.99 Charizard sale is the example.
- A warned extreme price still affects the actionable median and range.
- Raw condition is only as good as the provider string. These Charizard raw sales arrived without one.
- Duplicate detection is the external listing id only.
- The 500-listing cap still makes a busy card’s window incomplete, and that incompleteness lowers evidence.
- Non-USD sales are still listed and left out of the USD median. There is no conversion.
- Evidence is not a prediction of the next price.
