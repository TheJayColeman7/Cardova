# Milestone 2: AI Card Scanner V1

Date: 2026-09-23.

This milestone adds card recognition only. A photo is uploaded, candidates are shown, and the user confirms a card before Sweet Home Cards opens an existing card page. It does not grade cards, store photos, calculate values, or create listings.

## Architecture

Recognition is a backend capability behind `CardRecognitionProvider`. The React scan page talks only to `POST /api/recognition/cards` and receives a Sweet Home Cards `RecognitionResult`. It does not know which vendor produced the candidates.

```text
Scan page (Blob/File)
  → multipart POST /api/recognition/cards
  → image validation
  → CardRecognitionProvider.identifyCard
  → Scrydex Vision adapter (Pokemon request)
  → normalize to RecognitionCandidate
  → resolve against pokemon_cards
  → JSON result
  → user confirms
  → /card/{canonicalCardId} or /search
```

`RecognitionCandidate` is evidence from a provider. It is not a `Card`. `providerCardId` is never copied into `canonicalCardId`. The canonical id is set only when the Pokémon repository returns exactly one strong match, as `pokemon:{apiId}`.

The generic types in `cardova-backend/src/domain/recognition.ts` do not assume Pokémon. The Scrydex adapter is the place that sends `games=pokemon` and maps that vendor’s JSON. A later One Piece, Yu-Gi-Oh, Magic, or sports provider can implement the same interface without changing the scan page.

## Recognition flow

1. The scan page keeps the rear-camera capture, torch when the device supports it, the card-shaped guide, and JPEG capture. Capture is a `File` (`scan.jpg`), not a `sessionStorage` data URL.
2. Choose Photo uses a file input that accepts JPEG, PNG, and WebP.
3. The browser posts one field, `image`, as `multipart/form-data`.
4. The server checks the declared type and the file bytes, then calls the provider. The bytes are not written to object storage.
5. The page shows “We think this is…” with the first candidate large and up to four more beside it (five total).
6. This Is My Card is available only when `resolutionStatus` is `resolved` and `canonicalCardId` is set. That navigates to `/card/{canonicalCardId}`.
7. A recognized card that is `unresolved` or `ambiguous` offers Search Sweet Home Cards with the name and number filled in. None of These, and Type the card name instead, go to `/search` with no query. Recognition does not confirm a card by itself.

## API route

`POST /api/recognition/cards`

Input: `multipart/form-data` with exactly one part named `image`.

Success body is the normalized result:

```json
{
  "provider": "scrydex",
  "game": "Pokemon",
  "outcome": "candidates",
  "candidates": []
}
```

`outcome` is `candidates` or `no_card_detected`. A photo with no detected card is HTTP 200 and an empty `candidates` array.

Application errors are `{ "error", "message" }` only. Raw provider bodies are not returned.

| Condition | HTTP | `error` |
| --- | --- | --- |
| Unsupported type, or bytes that do not match the declared type | 415 | `unsupported_type` |
| Larger than 10 MB | 413 | `image_too_large` |
| Missing multipart, wrong field, more than one image, or a broken body | 400 | `invalid_upload` |
| Missing credentials, or the provider cannot be reached | 503 | `provider_unavailable` |
| Provider timeout | 504 | `recognition_timeout` |
| Provider JSON that is not a Vision identify payload | 502 | `provider_response` |

## Environment variables

Names only, both read on the server:

- `SCRYDEX_API_KEY`
- `SCRYDEX_TEAM_ID`

If either is missing, identify is not called and the route returns `provider_unavailable`. Neither value is sent to the browser or written in recognition logs.

## Image limits

Allowed types, checked from the part’s content type and from magic bytes: `image/jpeg`, `image/png`, `image/webp`. The filename is ignored.

Maximum size: 10 MB (`MAX_IMAGE_BYTES`). The provider documents a higher ceiling; this app uses 10 MB for the MVP. A `Content-Length` above 10 MB plus 64 KB of multipart overhead is rejected before the file is fully read.

## Normalized candidate

| Field | Meaning |
| --- | --- |
| `provider` | Provider id. The first implementation is `scrydex`. |
| `providerCardId` | Id in that provider’s catalog. Not a Sweet Home Cards id. |
| `providerScore` | The score the provider returned, unchanged. Scrydex Vision scores are not probabilities (their docs describe a range that can sit above 1). |
| `confidence` | Null for Scrydex. No 0–1 confidence is invented from `providerScore`. |
| `game` | Display game name when the adapter knows the code (`Pokemon`, `One Piece`, `Magic`, and the other codes that adapter maps). Unknown codes stay null. |
| `language` | Language code from the provider when present. |
| `name`, `setId`, `setName`, `cardNumber` | Identity fields used for catalog resolution. |
| `variant`, `finish` | Finish is set only for holo / holofoil / reverse holo labels. Other variant text stays in `variant`. |
| `imageUrl` | Provider image URL for the candidate thumbnail. |
| `canonicalCardId` | `pokemon:{apiId}` after a unique repository match. Otherwise null. |
| `resolutionStatus` | `resolved`, `ambiguous`, or `unresolved`. |

Graded-slab details from Vision are ignored. Grade is not part of recognition or of card identity.

## Canonical resolution

English-first. A candidate whose language is present and is not `EN` or `English` stays `unresolved`, even if an English row would match. A missing language is still eligible.

Resolution runs only for `game === "Pokemon"` with both a name and a card number. Other games stay `unresolved` and do not query the Pokémon table.

The repository loads rows whose name matches exactly, case-insensitive, then the service keeps rows whose collector number matches exactly or as the same integer (`004` and `4`). Set name or set id is compared the same way, exact and case-insensitive.

- One set-id hit: `resolved`, unless the set name also matches a different print, which stays `ambiguous`.
- No set-id hit, and one set-name hit: `resolved`.
- A provided set id or set name that matches nothing: `unresolved`, even when only one name-and-number row exists.
- Both set id and set name omitted, and exactly one name-and-number row: `resolved`.
- Both set fields omitted, and more than one name-and-number row: `ambiguous`.
- No rows: `unresolved`.

An ambiguous result does not pick a row. Recognition does not insert Pokémon rows.

If the catalog lookup throws, the candidate stays `unresolved` and the error message is logged. The user can still search by the recognized name.

## Files added or changed

Added:

- `cardova-backend/src/domain/recognition.ts`
- `cardova-backend/src/recognition/recognitionError.ts`
- `cardova-backend/src/recognition/resolvePokemonCandidate.ts`
- `cardova-backend/src/recognition/resolvePokemonCandidate.test.ts`
- `cardova-backend/src/providers/scrydex/mapScrydexVision.ts`
- `cardova-backend/src/providers/scrydex/mapScrydexVision.test.ts`
- `cardova-backend/src/providers/scrydex/scrydexVisionProvider.ts`
- `cardova-backend/src/providers/scrydex/scrydexVisionProvider.test.ts`
- `cardova-backend/src/http/imageUpload.ts`
- `cardova-backend/src/http/imageUpload.test.ts`
- `cardova-backend/src/services/recognitionService.ts`
- `cardova-backend/src/services/recognitionService.test.ts`
- `cardova-backend/src/routes/recognition.ts`
- `cardova/src/components/RecognitionCandidates.jsx`

Changed:

- `cardova-backend/server.js` mounts `/api/recognition`
- `cardova-backend/src/config/env.ts` reads the two Scrydex names
- `cardova-backend/.env.example` lists those names empty
- `cardova-backend/src/repositories/pokemonCardRepository.ts` adds `findPokemonCardsByNameAndNumber`
- `cardova-backend/package.json` and lockfile add `busboy` and the new tests
- `cardova/src/pages/Scan.jsx` uploads the photo and shows candidates
- `cardova/src/pages/Home.jsx` scan sentence now says to confirm the card

## Logging

Info logs record that a request started (MIME type and byte length), then provider id, latency, candidate count, and each resolution status. Logs do not include API keys, team id, image bytes, authorization headers, or the provider payload.

## Automated tests

Scrydex is mocked. Tests do not call the network and do not spend credits.

Covered:

- Vision JSON maps to a candidate and keeps the provider score
- Provider card id does not become the canonical id
- One exact Pokémon name, number, and set resolves to `pokemon:{apiId}`
- Zero repository rows stay unresolved
- Two prints that the set does not separate stay ambiguous
- A non-English candidate is not attached to an English row
- GIF and mismatched bytes are rejected
- An image over the limit is rejected
- Two images and a broken multipart body are rejected
- A provider HTTP failure becomes `provider_unavailable` and the message does not include the fake secret body
- Missing credentials do not call the provider
- No matches return `outcome: "no_card_detected"`
- A resolved id still opens card detail with `soldComps: []`

`npm test` and `npx tsc --noEmit` passed in `cardova-backend`. `npm run lint` and `npm run build` passed in `cardova`.

## Manual test results

Checked on 2026-09-23 by calling the recognition service directly. Scrydex credentials were present. `images.pokemontcg.io` reset the connection from this machine, so the card images came from `assets.tcgdex.net`. These four images are not a measure of recognition accuracy.

1. Clear Base Set Charizard, PNG, 360,481 bytes. Outcome `candidates`. Top match: Charizard, Base, number 4, language EN, provider score 1.14933. The next four were other Charizard prints (Legendary Collection #3, Base Set 2 #4, and two classic-collection #4s). Latency about 1.2s.
2. Jungle #1, WebP, 84,406 bytes. Top match: Clefable, Jungle, number 1, language EN, provider score 1.13815. The next candidates were other Clefable prints. Latency about 1.5s.
3. Small Charizard WebP, 20,190 bytes. Same top match as the clear image: Charizard, Base, number 4, score 1.09951. A larger Base Charizard PNG (838,044 bytes) also returned that same top match at score 1.15. Neither file was a blurry phone photo.
4. A non-card JPEG, 21,767 bytes. Outcome `no_card_detected`, zero candidates, in about 0.3s. The catalog was not queried.

Every card candidate stayed `unresolved` with `canonicalCardId` null. Postgres rejected the lookup because `DATABASE_PASSWORD` is empty (`client password must be a non-empty string`). No card page was opened from a scan.

What was exercised before credentials were present:

- A JPEG posted to the new route, with credentials absent, returned HTTP 503 `{ "error": "provider_unavailable", "message": "Card recognition is unavailable." }`. The body did not contain a key or a provider payload.
- A GIF returned HTTP 415 `unsupported_type`.
- A non-multipart body returned HTTP 400 `invalid_upload`.
- In the browser at `http://localhost:5173/scan`, the page shows the card guide, Take photo, Choose Photo, and Type the card name instead. Take photo stayed disabled because this browser session did not grant a camera. Type the card name instead opened `/search`.
- `/card/catalog%3Amahomes-2017-prizm` still shows sample prices, the line “Sold comps are not available yet.”, and active eBay listings with asking prices and shipping. Those listings are labeled as cards for sale now, not sold prices.

The API process already listening on port 3001 was started before this route existed. `POST /api/recognition/cards` on that process returns Express 404 HTML. Restart that process so the scan page’s proxy can reach the new route. This check did not stop that process.

That earlier pass did not open a card page. `DATABASE_PASSWORD` was empty then. The later check in Final End-to-End Verification is the current database state.

## Provider dependency

Scrydex Vision is the current recognition implementation behind `CardRecognitionProvider`. Sweet Home Cards does not own Scrydex card data or models. Commercial and public usage terms, and any authorization Scrydex requires, need to be confirmed before this provider is used for a paid production launch.

## Known limitations

- The Vision request is scoped to Pokémon. Other games are representable on the candidate, but this provider does not ask for them yet.
- Non-English candidates are left unresolved rather than matched to an English print.
- `confidence` is null. The UI shows `providerScore` as a score, not a percent.
- Name lookup is capped at 1,000 rows before number filtering. A very common name could miss a number match beyond that cap.
- A name-and-number match resolves without a set only when the provider sent no set id and no set name. A conflicting set stays unresolved.
- Catalog errors during resolution leave the candidate unresolved instead of failing the HTTP request.
- Photos are not stored, so a scan cannot be replayed later.
- The scan page does not show the provider name.

## Unresolved questions

- Which Scrydex plan and authorization cover a public Sweet Home Cards deployment?
- Should a later milestone match Japanese (and other) languages to their own catalog rows?
- Is 10 MB the right phone-capture limit once real camera JPEGs are measured?

## Pokemon Catalog Provider Migration

The active importer no longer calls `api.pokemontcg.io`. That API is deprecated, and `npm run import:cards` now reads the Scrydex English list `GET /pokemon/v1/en/cards`. The old client remains in `cardova-backend/src/services/pokemonTcgApi.ts` and is marked deprecated. It is not on the import path.

The request uses server-side `X-Api-Key` and `X-Team-ID`, `page_size` 100, `casing=snake`, and a `select` list of identity fields. It does not send `include=prices`. Each page is mapped into the existing `pokemon_cards` columns and upserted on `api_id`. A Scrydex id such as `base1-4` is stored as `api_id`, so the Sweet Home Cards id stays `pokemon:base1-4`. Language is kept on the stored provider object as `language` and `language_code`. The table has no language column, and the shared Card `language` field is still null.

Mapped columns: `api_id`, `card_name`, `pokemon_name`, `card_number`, `set_id`, `set_name`, `series_name`, `rarity`, `artist`, `supertype`, `subtypes`, `pokemon_types`, `hp`, image URLs, `release_date`, Pokédex number, and `raw_data`.

Import on 2026-09-23: 253 pages, 25,209 cards received, 25,209 inserted, 0 updated, 0 failed, 0 retries, 236 seconds. `pokemon_cards` row count afterward: 25,209.

## Final End-to-End Verification

Checked on 2026-09-23 after the Scrydex import. The API on port 3001 was restarted onto the current code.

- Database reachable: yes.
- `pokemon_cards` count: 25,209.
- Card used: Base Set Charizard, a PNG of the English #4 card.
- Scrydex top result: Charizard, set Base, number 4, language EN, provider score 1.14933.
- `resolutionStatus`: `resolved`.
- `canonicalCardId`: `pokemon:base1-4`.
- Card detail result: `GET /api/cards/pokemon%3Abase1-4` returned 200 with `card.id` `pokemon:base1-4`, name Charizard, source id `base1-4`.
- Active listing behavior: `GET /api/cards/pokemon%3Abase1-4/listings` returned 8 records, each `dataType` `active_listing`.
- `soldComps`: `[]` on both the card response and the listings response.
- Browser test result: `/card/pokemon:base1-4` opened Charizard, Base, #4, 1999. The page showed “For sale on eBay”, “These are cards people are selling right now — not sold prices.”, eight asking prices, and “Sold comps are not available yet.” The scan page showed Choose Photo. The automated browser did not attach a file to that input, so the This Is My Card button was not clicked there. The photo was posted to the same recognition route the scan page uses, and the card page that button opens was then opened in the browser.
- Remaining limitation: Card `language` is still null because `pokemon_cards` has no language column. The English code is on the stored provider object. These checks are not a measure of recognition accuracy.

Backend tests: 50 passed. `npx tsc --noEmit`, frontend lint, and the frontend build passed.
