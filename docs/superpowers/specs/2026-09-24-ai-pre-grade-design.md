# Milestone 4 AI Pre-Grade Assistant V1 Design

Date: 2026-09-24

## Goal

Add a conservative, explainable PSA-style pre-grade assessment for a confirmed Sweet Home Cards card from one front photo and one back photo.

The assessment reports a whole-number grade range, visible condition findings, image-quality information, component assessments, and confidence in the image-based assessment. It is not an official grade, a guaranteed outcome, or a grade-versus-sell recommendation.

## Scope

V1 includes:

- one PSA-style grading profile
- required front and back images
- deterministic image-quality and centering analysis
- OpenAI visual analysis for visible corner, edge, and surface defects
- deterministic grade-range and confidence aggregation
- retake-required responses when either image is unusable
- an in-memory request flow with no permanent image or assessment storage
- a dedicated card-scoped frontend wizard

V1 excludes market values, profitability, grade-or-don't-grade decisions, exact-grade guarantees, other grading-company profiles, angled photos, permanent photo storage, model training, marketplace listings, payments, subscriptions, and portfolio features.

## Architecture

The request flows through application-owned boundaries:

```text
Card Detail
  -> /card/:id/pregrade
  -> POST /api/cards/:id/pregrade
  -> dual-image upload validation
  -> deterministic image analyzer
  -> image-quality gate
  -> OpenAI pre-grade provider
  -> provider-result validation and normalization
  -> deterministic assessment aggregator
  -> normalized PreGradeAssessment response
```

The pre-grade domain does not import OpenAI types. Provider prompts, JSON schema, SDK response handling, and provider errors remain under the OpenAI provider implementation. React receives only Sweet Home Cards domain objects.

Recognition, pre-grade analysis, and market analysis remain separate services. The pre-grade service receives the confirmed `Card` and the two images. It does not receive sold comps, active listings, sample prices, or market summaries.

## Domain Model

`src/domain/preGrade.ts` defines the normalized contract.

Image roles are an extensible union:

```text
front | back | front_angle | back_angle | corner_closeup | surface_closeup
```

The V1 upload contract accepts exactly `front` and `back`.

The response has:

- `cardId`
- `graderProfile: "psa_style"`
- `status: "complete" | "retake_required"`
- `estimatedGrade: { min, max } | null`
- `confidence: "very_low" | "low" | "moderate" | "high" | null`
- image-quality assessments for front and back
- centering assessments for front and back
- component assessments for corners, edges, and surface
- normalized findings
- limitations
- retake instructions when applicable

A component assessment has a rating, confidence label, and findings. Ratings are:

```text
strong | minor_concerns | moderate_concerns | major_concerns | unavailable
```

A finding has:

- an allowlisted code
- severity: `info | minor | moderate | major`
- side: `front | back | both`
- location
- concise description
- optional provider evidence text

The provider never supplies the final grade range. The domain aggregator derives it from normalized component results.

No assessment ID is returned because V1 does not persist assessments. The model leaves room for an actual professional grade to be attached in a later persisted-assessment milestone without adding that feature now.

## Upload and Retention

`POST /api/cards/:id/pregrade` accepts `multipart/form-data` with exactly:

- `front=<image>`
- `back=<image>`

Each file:

- must be JPEG, PNG, or WebP
- must have a declared MIME matching its magic bytes
- may be at most 10 MB

The parser enforces exactly one file per required field, rejects unknown file fields and duplicate roles, limits ordinary form fields, and rejects malformed multipart input. A combined request-size limit covers two maximum-size images plus bounded multipart overhead.

After decode, each image is also subject to dimension and total-pixel limits so a small compressed file cannot cause excessive memory use. The initial maximum is 40 megapixels per image. Images above that limit receive a validation error with retake guidance.

Images remain in process memory for the request. Sharp-derived buffers, crops, and OpenAI data URLs are released when the request finishes. V1 writes no image to disk, database, object storage, logs, or OpenAI Files storage. Logs contain card ID, MIME, byte count, dimensions, stage, duration, and status only.

OpenAI receives base64 data URLs in one Responses API request. The application does not upload persistent provider files. Provider timeout and errors are mapped to short application messages; provider response bodies are not exposed or logged.

## Deterministic Image Processing

Sharp performs safe decode, EXIF autorotation, resize, encode, compositing, and raw-pixel extraction. Pure TypeScript modules perform image metrics and geometry.

Processing occurs in memory:

1. validate bytes and decoded dimensions
2. autorotate from EXIF
3. create a bounded analysis-resolution image
4. calculate quality metrics
5. attempt physical card-boundary detection
6. order detected corners
7. estimate crop confidence and perspective
8. normalize through a TypeScript homography when confidence is sufficient
9. create corner crops, edge strips, and labeled inspection sheets
10. attempt printed-border measurements

The outer-boundary detector operates on luminance and color contrast against the surrounding background. It searches for the largest card-shaped quadrilateral near the expected trading-card aspect ratio. It does not use Pokémon artwork borders as the physical card edge.

Corner ordering is deterministic: top-left, top-right, bottom-right, bottom-left based on sum/difference geometry, with convexity and non-intersection checks.

Perspective normalization solves a four-point homography and inverse-maps into a portrait card rectangle. Sharp encodes the generated raw image. If quadrilateral confidence is low, no normalized crop is claimed. The provider receives the original image and the assessment records crop fallback. A partially clipped card or severe perspective failure is unusable; a fully visible card with a weak automatic crop may proceed cautiously using the original.

## Image-Quality Gate

Each side is classified as `good`, `usable`, `poor`, or `unusable`. The implementation records individual checks and retake guidance.

Initial rules:

- resolution is unusable below 800 pixels on the short edge or below 1 megapixel
- resolution is poor below 1200 pixels on the short edge or below 2 megapixels
- resolution is good at 1600 or more pixels on the short edge and at least 4 megapixels
- normalized mean luminance below 25 or above 235 is unusable
- normalized mean luminance below 45 or above 220 is poor
- a Laplacian-variance sharpness score below 20 is unusable
- a sharpness score below 45 is poor
- a sharpness score below 90 is usable
- clipped highlight/glare coverage above 20% is unusable
- clipped highlight/glare coverage above 10% is poor
- clipped highlight/glare coverage above 3% is usable with a glare finding
- a detected card with any physical corner outside the image is unusable
- a card occupying less than 45% of the frame is poor
- heavy perspective that prevents reliable normalization or component visibility is unusable

These are Sweet Home Cards V1 heuristics, not grading-company standards. Thresholds are constants with focused unit tests so they can be calibrated later.

If either side is unusable, the service returns `retake_required`, no estimated grade, and no provider call. A poor image may proceed only when the complete physical card remains visible and the critical regions can still be inspected. Poor quality materially reduces confidence and produces explicit limitations.

## Centering

Centering is the most deterministic condition component.

After physical-edge normalization, a generic printed-frame detector searches inward from each physical edge for stable, high-contrast frame transitions. It measures:

- front left/right
- front top/bottom
- back left/right
- back top/bottom

Ratios are normalized to sum to 100 and rounded to whole percentages for display, while unrounded values remain available internally.

A measurement is returned only when all lines needed for that axis have adequate contrast, continuity, and geometric agreement. Otherwise:

```text
measurementAvailable = false
```

The generic detector does not assume every design has symmetrical borders. If a side or axis cannot be measured reliably, the value is absent and assessment confidence is reduced. The boundary and centering interfaces accept a strategy identifier so card/set-specific algorithms can be added later without changing the domain response.

## OpenAI Visual Analysis

The semantic provider uses the OpenAI Responses API with:

- configurable `OPENAI_PRE_GRADE_MODEL`
- default model `gpt-5.6`
- original image detail
- strict JSON-schema structured output
- a request timeout

Inputs include card identity, processing limitations, normalized full-side images when available, originals when normalization is unavailable, and labeled detail sheets for corners and edges. Detail sheets reduce the number of image inputs while preserving location labels.

The provider assesses only visible:

- corner whitening, rounding, fraying, chips, and bends
- edge whitening, chips, roughness, wear, and damage
- obvious scratches, print lines, stains, discoloration, creases, large dents, surface wear, and obvious print defects

The prompt forbids official-grade claims, hidden-defect claims, price analysis, and a final numeric grade. It requires uncertainty when the photo does not support a conclusion.

The mapper rejects unknown enum values, invalid locations, excessive findings, overlong descriptions, malformed structured output, and any provider field outside the schema. The normalized response never includes model IDs, token data, raw response text, or provider-specific confidence numbers.

## Standardized Findings

V1 uses a small allowlist:

- `corner_whitening`
- `corner_rounding`
- `corner_fraying`
- `corner_bend`
- `edge_whitening`
- `edge_chip`
- `edge_wear`
- `surface_scratch`
- `surface_print_line`
- `surface_crease`
- `surface_stain`
- `surface_discoloration`
- `surface_dent_visible`
- `surface_wear`
- `missing_material`
- `centering_left_right`
- `centering_top_bottom`
- `image_glare`
- `image_blur`
- `image_dark`
- `image_overexposed`
- `card_clipped`
- `perspective_heavy`
- `crop_unreliable`

Locations are constrained to meaningful values such as top-left corner, bottom edge, center surface, or whole side.

## Grade-Range Heuristic

The grade engine consumes deterministic centering, normalized component severities, image quality, and visible major defects. It never parses a grade from free-form provider prose.

The initial component baseline is:

- no concern stronger than minor: `9-10`
- one or more minor concerns: `8-9`
- one or more moderate concerns: `6-8`
- one or more major concerns: `3-6`

Centering can lower the maximum:

- both axes at 55/45 or better: no centering ceiling
- worst axis through 60/40: maximum 9
- worst axis through 65/35: maximum 8
- worst axis through 70/30: maximum 7
- worse than 70/30: maximum 6

The worst measurable front/back axis supplies the ceiling. Unavailable centering lowers confidence but does not invent a grade penalty.

Major-defect safety ceilings override attractive centering:

- major crease, missing material, large visible dent, or major surface damage: maximum 5
- major corner bend or major edge damage: maximum 6
- moderate crease: maximum 7

The final bounds are clamped to 1 through 10. The engine always returns a range at least one grade wide. If ceilings collapse the bounds, the lower bound is moved down; it never returns a single-number guarantee.

These are documented Sweet Home Cards heuristics, not PSA formulas.

## Assessment Confidence

Confidence describes the quality of this image-based assessment, not the probability of receiving a grade.

Start at `high` only when:

- both images are good
- both physical card boundaries are reliable
- front and back centering are measurable
- surface visibility is not limited
- provider component confidence is high
- deterministic and semantic observations do not conflict

Downgrade one level for each distinct limitation category:

- either image is usable instead of good
- crop fallback or weak boundary confidence
- a missing centering side or axis
- glare or blur warning
- limited surface visibility
- any provider component confidence is low
- deterministic and semantic findings materially disagree

Any poor image sets an upper confidence limit of `low`. Two or more critical component assessments marked unavailable set an upper limit of `very_low`. A complete result may therefore have very-low confidence, but an image that cannot support a responsible range returns `retake_required`.

No percentage is returned.

## API and Error Handling

Endpoint:

```text
POST /api/cards/:id/pregrade
```

The route first loads the confirmed card with `cardService.getCard`. Unknown cards return 404 before provider analysis.

Successful complete response:

```json
{
  "cardId": "pokemon:base1-4",
  "graderProfile": "psa_style",
  "status": "complete",
  "estimatedGrade": { "min": 8, "max": 9 },
  "confidence": "moderate",
  "imageQuality": {},
  "centering": {},
  "corners": {},
  "edges": {},
  "surface": {},
  "findings": [],
  "limitations": []
}
```

Inadequate images return HTTP 200 with `status: "retake_required"` because the request was valid and the assessment produced an actionable retake result. `estimatedGrade` and `confidence` are null.

Upload validation uses 400, 413, or 415. Provider timeout uses 504, malformed provider output uses 502, and provider unavailability uses 503. Responses use application messages and never expose provider bodies.

The provider request runs only after deterministic gating. A small in-process concurrency cap protects the expensive decode/provider path; excess work returns 429 with retry guidance. This is process-local protection, not an authentication or distributed rate-limit system.

## Frontend

Card Detail adds an `Analyze for Grading` button immediately below the confirmed card identity and before sold-market data. Market UI remains unchanged.

The button opens:

```text
/card/:id/pregrade
```

The route is a full-screen, mobile-first wizard and hides the normal application header. Its state is local and ephemeral:

```text
front -> back -> review -> analyzing -> results
```

The capture component is extracted from the existing Scan camera behavior and reused by both Scan and pre-grade capture. It supports the environment-facing camera, torch when available, file selection, a card-shaped guide, permission fallback, and cleanup of media tracks and object URLs.

Capture guidance consistently asks users to remove sleeves/toploaders when safe, use a clean flat background, photograph straight above, fill most of the frame, avoid glare, use good light, and keep all edges and corners visible.

Review shows both labeled previews with per-side Retake actions. Nothing is uploaded until the user selects Analyze.

Results prioritize:

1. Estimated PSA-style range
2. Assessment confidence
3. Centering
4. Corners
5. Edges
6. Surface
7. Visible concerns
8. Limitations
9. Retake Photos

Findings are short rows with status icon, side/location, and description. The UI says “No major surface issue visible in this photo” only when supported and always shows the flat-photo limitation for fine scratches, indentations, pressure marks, subtle print lines, and texture issues.

The UI never says official grade, guaranteed grade, “PSA says,” or “you will get.” It never shows profitability or market values inside the assessment.

Accessibility includes 44-pixel touch targets, descriptive image alt text, visible text in addition to color, `aria-live` status updates, reachable close/back controls, and camera fallback. Camera use requires a secure context outside localhost.

## Testing

All production behavior follows test-first development.

Backend deterministic unit tests cover:

- image-quality classifications and threshold boundaries
- MIME/magic-byte checks for both fields
- exactly one front and one back
- total and per-file size limits
- decoded-pixel limit
- malformed multipart input
- corner coordinate ordering
- invalid/non-convex corner sets
- perspective transform geometry
- centering ratio calculations
- unavailable border measurements
- corner and edge crop coordinates
- grade-range aggregation
- whole-number range width
- centering ceilings
- major-defect ceilings
- confidence downgrades and caps
- unusable image returns `retake_required`
- unusable image does not call OpenAI
- provider output is normalized and raw fields do not leak
- market fields are absent from `PreGradeAssessment`
- sold comps are not dependencies of the pre-grade service
- provider error-body sanitization

Tests use generated synthetic images and a mock `PreGradeProvider`. Automated tests do not call OpenAI or spend API credits.

The existing frontend has no component-test harness. V1 frontend verification uses lint, production build, and browser testing of the wizard states, camera/file fallback, retakes, upload errors, retake-required results, complete results, and responsive layout.

## Development and Manual Fixtures

The repository adds:

```text
dev-fixtures/grading/
  README.md
  .gitkeep
```

Fixture image contents are gitignored. A developer may place rights-cleared files using:

```text
clean-modern-front.jpg
clean-modern-back.jpg
whitening-front.jpg
whitening-back.jpg
poor-centering-front.jpg
poor-centering-back.jpg
glare-front.jpg
glare-back.jpg
```

No rights-cleared fixture images are currently available. The implementation must not claim the four manual scenarios passed. The milestone documentation records those checks as pending local fixture images and includes the exact fields to record: image quality, centering, findings, range, confidence, and internal consistency.

## Documentation

The completed milestone document is `docs/MILESTONE_4_AI_PRE_GRADE.md`. It records architecture, provider boundary, image flow and retention, quality thresholds, normalization, centering, corner/edge/surface behavior, findings, range rules, confidence rules, safety ceilings, API, UI, automated results, manual-test status, known limitations, intentional exclusions, and the recommended next milestone.

No secret values or provider response bodies appear in documentation.

## Quality Gates

Backend:

```text
npm test
npx tsc --noEmit
```

Frontend:

```text
npm run lint
npm run build
```

The milestone is complete when a confirmed card can submit validated front and back photos, receive either honest retake guidance or an explainable conservative pre-grade range, and inspect the visible reasons and limitations without condition analysis being mixed with market data.
