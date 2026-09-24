# AI Pre-Grade Assistant V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a confirmed Sweet Home Cards card submit one front photo and one back photo and receive either honest retake guidance or a conservative, explainable PSA-style pre-grade range.

**Architecture:** Dual-image multipart upload stays in memory for one request. Sharp plus TypeScript geometry produce quality metrics, optional card normalization, centering measurements, and labeled inspection sheets. An OpenAI `PreGradeProvider` returns structured visible-defect findings only. A deterministic engine derives the grade range and assessment confidence. React receives only Sweet Home Cards domain objects.

**Tech Stack:** Node 18+, Express 5, TypeScript, `busboy`, `sharp`, OpenAI Responses API (`openai` SDK), React 19, Vite, Tailwind.

**Spec:** `docs/superpowers/specs/2026-09-24-ai-pre-grade-design.md`

## Global Constraints

- UI copy uses Pre-Grade, Estimated range, Visible condition, Assessment confidence. Never official grade, guaranteed grade, “PSA says,” or “you will get.”
- V1 grader profile is `psa_style` only. Grade bounds are whole numbers. Never return a single-number guaranteed grade.
- Upload fields are exactly `front` and `back`. JPEG, PNG, or WebP. 10 MB per file. Combined request size covers two max files plus 64 KB overhead. Decoded images cap at 40 megapixels.
- Images stay in process memory for the request. Do not write photos to disk, database, object storage, logs, or OpenAI Files.
- Logs contain card ID, MIME, byte count, dimensions, stage, duration, and status only. Never log image bytes, credentials, or provider bodies.
- Automated tests mock the provider. Tests do not call OpenAI or spend API credits.
- `PreGradeAssessment` must not contain sold market price, raw median, PSA price, grade profitability, or active eBay asks.
- Sold comps are not used to infer image condition. Pre-grade service does not import market modules.
- Node-only computer vision: Sharp plus TypeScript. No Python, no OpenCV, no native OpenCV bindings.
- Default model `gpt-5.6` via `OPENAI_PRE_GRADE_MODEL`. Image detail is `original`.
- No grading profitability, grade-or-don’t-grade decision, listings, OAuth, payments, subscriptions, native app, permanent photo library, or model training.
- Conventional commits. Do not skip git hooks.

## File Map

Create:

- `cardova-backend/src/domain/preGrade.ts` — domain types, finding allowlist, provider interface
- `cardova-backend/src/domain/preGrade.test.ts`
- `cardova-backend/src/preGrade/preGradeError.ts` — provider/orchestration errors
- `cardova-backend/src/http/preGradeUpload.ts` — dual-image multipart parser
- `cardova-backend/src/http/preGradeUpload.test.ts`
- `cardova-backend/src/domain/imageQuality.ts` — quality classification from metrics
- `cardova-backend/src/domain/imageQuality.test.ts`
- `cardova-backend/src/domain/cardGeometry.ts` — corner order, convexity, homography
- `cardova-backend/src/domain/cardGeometry.test.ts`
- `cardova-backend/src/domain/centering.ts` — ratio math and display rounding
- `cardova-backend/src/domain/centering.test.ts`
- `cardova-backend/src/domain/preGradeEngine.ts` — range, ceilings, confidence
- `cardova-backend/src/domain/preGradeEngine.test.ts`
- `cardova-backend/src/imaging/decodeCardImage.ts` — Sharp decode, EXIF, pixel cap
- `cardova-backend/src/imaging/decodeCardImage.test.ts`
- `cardova-backend/src/imaging/cardBoundary.ts` — outer-edge detection
- `cardova-backend/src/imaging/cardBoundary.test.ts`
- `cardova-backend/src/imaging/inspectionSheets.ts` — corner/edge crops and labeled sheets
- `cardova-backend/src/imaging/inspectionSheets.test.ts`
- `cardova-backend/src/providers/openai/mapOpenAiPreGrade.ts` — schema validation/mapping
- `cardova-backend/src/providers/openai/mapOpenAiPreGrade.test.ts`
- `cardova-backend/src/providers/openai/openAiPreGradeProvider.ts`
- `cardova-backend/src/providers/openai/openAiPreGradeProvider.test.ts`
- `cardova-backend/src/services/preGradeService.ts`
- `cardova-backend/src/services/preGradeService.test.ts`
- `cardova-backend/src/routes/preGrade.ts`
- `cardova/src/components/CameraCapture.jsx`
- `cardova/src/pages/PreGrade.jsx`
- `cardova/src/lib/grading.js`
- `docs/MILESTONE_4_AI_PRE_GRADE.md`
- `dev-fixtures/grading/README.md`
- `dev-fixtures/grading/.gitkeep`

Modify:

- `cardova-backend/src/http/imageUpload.ts` — export `MULTIPART_OVERHEAD_BYTES` and reuse `assertCardImage`
- `cardova-backend/src/config/env.ts` — OpenAI credentials and model
- `cardova-backend/.env.example`
- `cardova-backend/package.json` — `sharp`, `openai`, new test files
- `cardova-backend/server.js` — mount route
- `cardova/src/pages/Scan.jsx` — use `CameraCapture`
- `cardova/src/pages/CardDetail.jsx` — Analyze for Grading button
- `cardova/src/App.jsx` — `/card/:id/pregrade`, hide header
- `.gitignore` — fixture image contents

---

### Task 1: Domain types and finding allowlist

**Files:**
- Create: `cardova-backend/src/domain/preGrade.ts`
- Create: `cardova-backend/src/domain/preGrade.test.ts`
- Modify: `cardova-backend/package.json` (`test` script, add `src/domain/preGrade.test.ts`)

**Interfaces:**
- Consumes: nothing
- Produces: types and helpers later tasks import from `../domain/preGrade.js`

- [ ] **Step 1: Write the failing test**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FINDING_CODES,
  isFindingCode,
  isPreGradeAssessment,
} from "./preGrade.js";

describe("pre-grade domain", () => {
  it("accepts only the V1 finding allowlist", () => {
    assert.equal(isFindingCode("corner_whitening"), true);
    assert.equal(isFindingCode("surface_crease"), true);
    assert.equal(isFindingCode("not_a_real_code"), false);
    assert.ok(FINDING_CODES.includes("missing_material"));
  });

  it("rejects a market field on a pre-grade assessment object", () => {
    const assessment = {
      cardId: "pokemon:base1-4",
      graderProfile: "psa_style",
      status: "complete",
      estimatedGrade: { min: 8, max: 9 },
      confidence: "moderate",
      imageQuality: { front: null, back: null },
      centering: { front: null, back: null },
      corners: { rating: "strong", confidence: "high", findings: [] },
      edges: { rating: "strong", confidence: "high", findings: [] },
      surface: { rating: "strong", confidence: "high", findings: [] },
      findings: [],
      limitations: [],
      soldMedian: 35000,
    };
    assert.equal(isPreGradeAssessment(assessment), false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test src/domain/preGrade.test.ts`

Expected: FAIL with `Cannot find module` or `isFindingCode is not a function`

- [ ] **Step 3: Write minimal implementation**

Create `cardova-backend/src/domain/preGrade.ts` with this exact public surface:

```ts
import type { RecognitionImage } from "./recognition.js";

export type ImageRole =
  | "front"
  | "back"
  | "front_angle"
  | "back_angle"
  | "corner_closeup"
  | "surface_closeup";

export type CaptureRole = "front" | "back";

export type GraderProfile = "psa_style";
export type PreGradeStatus = "complete" | "retake_required";
export type AssessmentConfidence = "very_low" | "low" | "moderate" | "high";
export type ImageQualityClass = "good" | "usable" | "poor" | "unusable";
export type ComponentRating =
  | "strong"
  | "minor_concerns"
  | "moderate_concerns"
  | "major_concerns"
  | "unavailable";
export type FindingSeverity = "info" | "minor" | "moderate" | "major";
export type FindingSide = "front" | "back" | "both";
export type FindingLocation =
  | "top_left"
  | "top_right"
  | "bottom_left"
  | "bottom_right"
  | "top"
  | "right"
  | "bottom"
  | "left"
  | "center"
  | "whole"
  | "left_right"
  | "top_bottom";

export const FINDING_CODES = [
  "corner_whitening",
  "corner_rounding",
  "corner_fraying",
  "corner_bend",
  "edge_whitening",
  "edge_chip",
  "edge_wear",
  "surface_scratch",
  "surface_print_line",
  "surface_crease",
  "surface_stain",
  "surface_discoloration",
  "surface_dent_visible",
  "surface_wear",
  "missing_material",
  "centering_left_right",
  "centering_top_bottom",
  "image_glare",
  "image_blur",
  "image_dark",
  "image_overexposed",
  "card_clipped",
  "perspective_heavy",
  "crop_unreliable",
] as const;

export type FindingCode = (typeof FINDING_CODES)[number];

export const MARKET_FORBIDDEN_KEYS = [
  "soldMedian",
  "rawMedian",
  "psaPrice",
  "profitability",
  "activeAsks",
  "soldComps",
  "listings",
] as const;

export interface Finding {
  code: FindingCode;
  severity: FindingSeverity;
  side: FindingSide;
  location: FindingLocation;
  description: string;
  evidence?: string;
}

export interface ComponentAssessment {
  rating: ComponentRating;
  confidence: AssessmentConfidence;
  findings: Finding[];
}

export interface ImageQualityAssessment {
  side: CaptureRole;
  rating: ImageQualityClass;
  checks: { code: FindingCode | "resolution"; passed: boolean; detail: string }[];
  retakeGuidance: string | null;
  width: number;
  height: number;
}

export interface AxisMeasurement {
  leftOrTop: number;
  rightOrBottom: number;
  display: string;
}

export interface SideCentering {
  measurementAvailable: boolean;
  strategy: "generic_printed_frame";
  leftRight: AxisMeasurement | null;
  topBottom: AxisMeasurement | null;
}

export interface EstimatedGrade {
  min: number;
  max: number;
}

export interface PreGradeAssessment {
  cardId: string;
  graderProfile: GraderProfile;
  status: PreGradeStatus;
  estimatedGrade: EstimatedGrade | null;
  confidence: AssessmentConfidence | null;
  imageQuality: { front: ImageQualityAssessment | null; back: ImageQualityAssessment | null };
  centering: { front: SideCentering | null; back: SideCentering | null };
  corners: ComponentAssessment;
  edges: ComponentAssessment;
  surface: ComponentAssessment;
  findings: Finding[];
  limitations: string[];
  retakeInstructions?: string[];
}

export interface PreGradeProviderImage {
  role: CaptureRole;
  kind: "original" | "normalized" | "detail_sheet";
  label: string;
  mimeType: RecognitionImage["mimeType"];
  bytes: Buffer;
}

export interface PreGradeProviderInput {
  card: { id: string; name: string; setName: string | null; cardNumber: string | null };
  images: PreGradeProviderImage[];
  processingNotes: string[];
}

export interface ProviderPreGradeResult {
  corners: ComponentAssessment;
  edges: ComponentAssessment;
  surface: ComponentAssessment;
  findings: Finding[];
  limitations: string[];
}

export interface PreGradeProvider {
  readonly id: string;
  assess(input: PreGradeProviderInput): Promise<ProviderPreGradeResult>;
}

export function isFindingCode(value: string): value is FindingCode {
  return (FINDING_CODES as readonly string[]).includes(value);
}

export function isPreGradeAssessment(value: unknown): value is PreGradeAssessment {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  for (const key of MARKET_FORBIDDEN_KEYS) {
    if (key in record) return false;
  }
  return (
    typeof record.cardId === "string" &&
    record.graderProfile === "psa_style" &&
    (record.status === "complete" || record.status === "retake_required") &&
    Array.isArray(record.findings) &&
    Array.isArray(record.limitations)
  );
}
```

Add `src/domain/preGrade.test.ts` to the `test` script in `cardova-backend/package.json`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test src/domain/preGrade.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add cardova-backend/src/domain/preGrade.ts cardova-backend/src/domain/preGrade.test.ts cardova-backend/package.json
git commit -m "feat: add pre-grade domain types"
```

---

### Task 2: Dual-image upload parser

**Files:**
- Modify: `cardova-backend/src/http/imageUpload.ts` — export `MULTIPART_OVERHEAD_BYTES`
- Create: `cardova-backend/src/http/preGradeUpload.ts`
- Create: `cardova-backend/src/http/preGradeUpload.test.ts`
- Modify: `cardova-backend/package.json` test script

**Interfaces:**
- Consumes: `assertCardImage`, `ImageUploadError`, `MAX_IMAGE_BYTES` from `imageUpload.ts`; `CaptureRole` conceptually as field names `front`/`back`
- Produces: `parsePreGradeImages(req): Promise<{ front: RecognitionImage; back: RecognitionImage }>`

- [ ] **Step 1: Write the failing test**

Copy the `asRequest` / `multipart` helpers from `src/http/imageUpload.test.ts`. Tests:

```ts
it("accepts exactly one JPEG front and one JPEG back", async () => {
  const form = multipart([
    { name: "front", filename: "front.jpg", type: "image/jpeg", body: jpeg },
    { name: "back", filename: "back.jpg", type: "image/jpeg", body: jpeg },
  ]);
  const images = await parsePreGradeImages(asRequest(form.body, form.contentType));
  assert.equal(images.front.mimeType, "image/jpeg");
  assert.equal(images.back.mimeType, "image/jpeg");
});

it("rejects a missing back image", async () => {
  const form = multipart([{ name: "front", filename: "front.jpg", type: "image/jpeg", body: jpeg }]);
  await assert.rejects(parsePreGradeImages(asRequest(form.body, form.contentType)), (error: unknown) => {
    assert.ok(error instanceof ImageUploadError);
    assert.equal(error.code, "invalid_upload");
    return true;
  });
});

it("rejects an unknown file field", async () => {
  const form = multipart([
    { name: "front", filename: "front.jpg", type: "image/jpeg", body: jpeg },
    { name: "side", filename: "side.jpg", type: "image/jpeg", body: jpeg },
  ]);
  await assert.rejects(parsePreGradeImages(asRequest(form.body, form.contentType)), (error: unknown) => {
    assert.ok(error instanceof ImageUploadError);
    assert.equal(error.code, "invalid_upload");
    return true;
  });
});

it("rejects duplicate front fields", async () => {
  const form = multipart([
    { name: "front", filename: "a.jpg", type: "image/jpeg", body: jpeg },
    { name: "front", filename: "b.jpg", type: "image/jpeg", body: jpeg },
    { name: "back", filename: "c.jpg", type: "image/jpeg", body: jpeg },
  ]);
  await assert.rejects(parsePreGradeImages(asRequest(form.body, form.contentType)), (error: unknown) => {
    assert.ok(error instanceof ImageUploadError);
    assert.equal(error.code, "invalid_upload");
    return true;
  });
});

it("rejects a mismatched MIME and magic bytes", async () => {
  const form = multipart([
    { name: "front", filename: "front.jpg", type: "image/jpeg", body: Buffer.from("not a jpeg") },
    { name: "back", filename: "back.jpg", type: "image/jpeg", body: jpeg },
  ]);
  await assert.rejects(parsePreGradeImages(asRequest(form.body, form.contentType)), (error: unknown) => {
    assert.ok(error instanceof ImageUploadError);
    assert.equal(error.code, "unsupported_type");
    return true;
  });
});

it("rejects a payload larger than two max images plus overhead", async () => {
  const form = multipart([
    { name: "front", filename: "front.jpg", type: "image/jpeg", body: jpeg },
    { name: "back", filename: "back.jpg", type: "image/jpeg", body: jpeg },
  ]);
  const req = asRequest(form.body, form.contentType);
  req.headers["content-length"] = String(2 * MAX_IMAGE_BYTES + 65 * 1024);
  await assert.rejects(parsePreGradeImages(req), (error: unknown) => {
    assert.ok(error instanceof ImageUploadError);
    assert.equal(error.code, "image_too_large");
    return true;
  });
});

it("rejects malformed multipart input", async () => {
  await assert.rejects(
    parsePreGradeImages(asRequest(Buffer.from("this is not multipart"), "multipart/form-data; boundary=----nope")),
    (error: unknown) => {
      assert.ok(error instanceof ImageUploadError);
      assert.equal(error.code, "invalid_upload");
      return true;
    }
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test src/http/preGradeUpload.test.ts`

Expected: FAIL, `parsePreGradeImages` missing

- [ ] **Step 3: Write minimal implementation**

Export `MULTIPART_OVERHEAD_BYTES` from `imageUpload.ts`.

In `preGradeUpload.ts`:

- Content-Length max = `2 * MAX_IMAGE_BYTES + MULTIPART_OVERHEAD_BYTES`
- Busboy limits: `files: 3`, `fileSize: MAX_IMAGE_BYTES`, `fields: 5`
- Allowed field names: `front`, `back`
- Reject extra/unknown/duplicate fields
- Require both after close
- Call `assertCardImage` on each

Error message for missing/unknown: `"Send exactly one front image and one back image."`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test src/http/preGradeUpload.test.ts`

Expected: PASS. Also run `npx tsx --test src/http/imageUpload.test.ts` to confirm recognition upload is unchanged.

- [ ] **Step 5: Commit**

```bash
git add cardova-backend/src/http/imageUpload.ts cardova-backend/src/http/preGradeUpload.ts cardova-backend/src/http/preGradeUpload.test.ts cardova-backend/package.json
git commit -m "feat: parse front and back pre-grade uploads"
```

---

### Task 3: Image-quality classification

**Files:**
- Create: `cardova-backend/src/domain/imageQuality.ts`
- Create: `cardova-backend/src/domain/imageQuality.test.ts`

**Interfaces:**
- Consumes: `ImageQualityClass`, `FindingCode`, `CaptureRole` from `preGrade.ts`
- Produces:

```ts
export interface ImageQualityMetrics {
  width: number;
  height: number;
  meanLuminance: number;
  sharpness: number;
  glareCoverage: number;
  cardFillRatio: number | null;
  clippedCorner: boolean;
  perspectiveUnusable: boolean;
}

export function classifyImageQuality(side: CaptureRole, metrics: ImageQualityMetrics): ImageQualityAssessment
```

- [ ] **Step 1: Write failing tests** covering the spec thresholds:

```ts
it("marks resolution unusable below 800 short edge", () => {
  const result = classifyImageQuality("front", metrics({ width: 799, height: 1200 }));
  assert.equal(result.rating, "unusable");
  assert.match(result.retakeGuidance ?? "", /retake/i);
});

it("marks resolution poor below 1200 short edge", () => {
  const result = classifyImageQuality("front", metrics({ width: 1199, height: 1800, megapixelsOk: true }));
  assert.equal(result.rating, "poor");
});

it("marks a sharp, well-lit, large image good", () => {
  const result = classifyImageQuality("front", {
    width: 2000,
    height: 2800,
    meanLuminance: 120,
    sharpness: 120,
    glareCoverage: 0.01,
    cardFillRatio: 0.7,
    clippedCorner: false,
    perspectiveUnusable: false,
  });
  assert.equal(result.rating, "good");
  assert.equal(result.retakeGuidance, null);
});

it("marks glare above 20 percent unusable", () => {
  const result = classifyImageQuality("back", metrics({ glareCoverage: 0.21 }));
  assert.equal(result.rating, "unusable");
});

it("marks a clipped physical corner unusable", () => {
  const result = classifyImageQuality("front", metrics({ clippedCorner: true }));
  assert.equal(result.rating, "unusable");
});
```

Helper `metrics` should default to a good-quality 2000x2800 image so each test changes one axis. Worst check wins: unusable beats poor beats usable beats good.

- [ ] **Step 2: Run to verify fail**

Run: `npx tsx --test src/domain/imageQuality.test.ts`

- [ ] **Step 3: Implement constants and classifier**

Export named constants matching the spec exactly:

```ts
export const MIN_SHORT_EDGE_UNUSABLE = 800;
export const MIN_MEGAPIXELS_UNUSABLE = 1;
export const MIN_SHORT_EDGE_POOR = 1200;
export const MIN_MEGAPIXELS_POOR = 2;
export const MIN_SHORT_EDGE_GOOD = 1600;
export const MIN_MEGAPIXELS_GOOD = 4;
export const LUMINANCE_UNUSABLE_LOW = 25;
export const LUMINANCE_UNUSABLE_HIGH = 235;
export const LUMINANCE_POOR_LOW = 45;
export const LUMINANCE_POOR_HIGH = 220;
export const SHARPNESS_UNUSABLE = 20;
export const SHARPNESS_POOR = 45;
export const SHARPNESS_USABLE = 90;
export const GLARE_UNUSABLE = 0.2;
export const GLARE_POOR = 0.1;
export const GLARE_USABLE = 0.03;
export const MIN_CARD_FILL = 0.45;
```

Retake guidance examples:

- glare: `"We can't assess the front surface reliably because of glare. Retake the front photo with the light source moved to the side."`
- blur: `"The front photo is too blurry to assess corners and edges. Hold the camera still and retake."`

Use the `side` argument so guidance says front or back.

- [ ] **Step 4: Pass tests**

- [ ] **Step 5: Commit** `feat: classify pre-grade image quality`

---

### Task 4: Corner ordering and homography

**Files:**
- Create: `cardova-backend/src/domain/cardGeometry.ts`
- Create: `cardova-backend/src/domain/cardGeometry.test.ts`

**Interfaces:**
- Produces:

```ts
export interface Point { x: number; y: number }
export function orderCardCorners(points: Point[]): Point[]
export function isConvexQuad(points: Point[]): boolean
export function perspectiveMap(src: Point[], dst: Point[], point: Point): Point
export function invertHomography(h: number[]): number[]
```

`orderCardCorners` returns `[topLeft, topRight, bottomRight, bottomLeft]`.

- [ ] **Step 1: Failing tests**

```ts
it("orders four disordered corners clockwise from top-left", () => {
  const ordered = orderCardCorners([
    { x: 80, y: 10 },
    { x: 10, y: 10 },
    { x: 12, y: 90 },
    { x: 78, y: 88 },
  ]);
  assert.deepEqual(ordered[0], { x: 10, y: 10 });
  assert.deepEqual(ordered[1], { x: 80, y: 10 });
  assert.deepEqual(ordered[2], { x: 78, y: 88 });
  assert.deepEqual(ordered[3], { x: 12, y: 90 });
});

it("rejects a non-convex set", () => {
  assert.equal(
    isConvexQuad([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 4, y: 4 },
      { x: 0, y: 10 },
    ]),
    false
  );
});

it("maps a source corner onto the destination rectangle", () => {
  const src = [
    { x: 10, y: 10 },
    { x: 90, y: 12 },
    { x: 88, y: 80 },
    { x: 8, y: 78 },
  ];
  const dst = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ];
  const mapped = perspectiveMap(src, dst, src[0]);
  assert.ok(Math.abs(mapped.x) < 0.5);
  assert.ok(Math.abs(mapped.y) < 0.5);
});
```

Throw `Error("invalid_quad")` from `orderCardCorners` when `points.length !== 4` or `!isConvexQuad(ordered)`.

- [ ] **Step 2: Fail**
- [ ] **Step 3: Implement** sum/difference ordering; cross-product convexity and no segment intersection; 8-degree-of-freedom homography via Gaussian elimination on 8x8; inverse mapping for `perspectiveMap`
- [ ] **Step 4: Pass**
- [ ] **Step 5: Commit** `feat: order card corners and map perspective`

---

### Task 5: Centering ratio calculations

**Files:**
- Create: `cardova-backend/src/domain/centering.ts`
- Create: `cardova-backend/src/domain/centering.test.ts`

**Interfaces:**
- Produces:

```ts
export function axisRatio(near: number, far: number): AxisMeasurement
export function sideCenteringFromBorders(input: {
  left: number | null;
  right: number | null;
  top: number | null;
  bottom: number | null;
}): SideCentering
export function worstAxisImbalance(sides: SideCentering[]): number | null
```

`worstAxisImbalance` returns the larger share of the worse measurable axis (e.g. 60 for 60/40), or `null` if no axis is measurable.

- [ ] **Step 1: Failing tests**

```ts
it("normalizes a 53/47 split to display percentages that sum to 100", () => {
  const axis = axisRatio(53, 47);
  assert.equal(axis.display, "53/47");
  assert.equal(axis.leftOrTop + axis.rightOrBottom, 100);
});

it("does not invent values when a border is missing", () => {
  const side = sideCenteringFromBorders({ left: 10, right: 9, top: null, bottom: 8 });
  assert.equal(side.measurementAvailable, false);
  assert.equal(side.leftRight?.display, "53/47");
  assert.equal(side.topBottom, null);
});

it("treats a missing pair as unavailable rather than 50/50", () => {
  const side = sideCenteringFromBorders({ left: null, right: null, top: null, bottom: null });
  assert.equal(side.measurementAvailable, false);
  assert.equal(side.leftRight, null);
  assert.equal(side.topBottom, null);
});
```

`measurementAvailable` is true only when both axes have measurements.

Rounding: compute `leftPct = round(100 * near / (near + far))`, `rightPct = 100 - leftPct`.

- [ ] **Step 2: Fail**
- [ ] **Step 3: Implement with `strategy: "generic_printed_frame"`**
- [ ] **Step 4: Pass**
- [ ] **Step 5: Commit** `feat: calculate centering display ratios`

---

### Task 6: Grade range and confidence engine

**Files:**
- Create: `cardova-backend/src/domain/preGradeEngine.ts`
- Create: `cardova-backend/src/domain/preGradeEngine.test.ts`

**Interfaces:**
- Consumes: domain types, `worstAxisImbalance`
- Produces:

```ts
export function aggregatePreGrade(input: {
  imageQuality: { front: ImageQualityClass; back: ImageQualityClass };
  centering: { front: SideCentering; back: SideCentering };
  corners: ComponentAssessment;
  edges: ComponentAssessment;
  surface: ComponentAssessment;
  findings: Finding[];
  cropReliable: { front: boolean; back: boolean };
  surfaceVisibilityLimited: boolean;
  semanticConflict: boolean;
}): { estimatedGrade: EstimatedGrade; confidence: AssessmentConfidence; limitations: string[] }

export function emptyComponent(rating?: ComponentRating): ComponentAssessment
```

- [ ] **Step 1: Failing tests** — include every spec rule:

```ts
it("returns a 9-10 range when concerns are no worse than minor and centering is 55/45", () => {
  const result = aggregatePreGrade(cleanInput());
  assert.deepEqual(result.estimatedGrade, { min: 9, max: 10 });
});

it("never returns a single-number grade when ceilings collapse", () => {
  const result = aggregatePreGrade(
    cleanInput({
      findings: [finding("surface_crease", "major")],
      surface: { rating: "major_concerns", confidence: "high", findings: [] },
    })
  );
  assert.ok(result.estimatedGrade.max - result.estimatedGrade.min >= 1);
  assert.equal(result.estimatedGrade.max, 5);
});

it("applies a 60/40 centering ceiling of 9", () => {
  const result = aggregatePreGrade(cleanInput({ centeringImbalance: 60 }));
  assert.equal(result.estimatedGrade.max, 9);
});

it("does not invent a centering penalty when measurements are unavailable", () => {
  const result = aggregatePreGrade(cleanInput({ centeringAvailable: false }));
  assert.deepEqual(result.estimatedGrade, { min: 9, max: 10 });
  assert.notEqual(result.confidence, "high");
});

it("caps confidence at low when either image is poor", () => {
  const result = aggregatePreGrade(cleanInput({ imageQuality: { front: "poor", back: "good" } }));
  assert.ok(result.confidence === "low" || result.confidence === "very_low");
});

it("caps confidence at very_low when two critical components are unavailable", () => {
  const result = aggregatePreGrade(
    cleanInput({
      corners: { rating: "unavailable", confidence: "very_low", findings: [] },
      edges: { rating: "unavailable", confidence: "very_low", findings: [] },
    })
  );
  assert.equal(result.confidence, "very_low");
});
```

Also test: minor concerns → 8–9; moderate → 6–8; major (non-crease) → 3–6; moderate crease max 7; major corner bend max 6; missing material max 5.

Range clamp 1–10. If `max < min` after ceilings, set `min = max - 1` and if `min < 1` set `min = 1` and `max = 2`.

Confidence start `high` only when all start conditions in the spec hold. Each listed limitation category drops one step (`high`→`moderate`→`low`→`very_low`). Then apply poor-image and unavailable-component caps.

- [ ] **Step 2: Fail**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Pass**
- [ ] **Step 5: Commit** `feat: derive conservative pre-grade ranges`

---

### Task 7: Sharp decode and pixel limit

**Files:**
- Create: `cardova-backend/src/imaging/decodeCardImage.ts`
- Create: `cardova-backend/src/imaging/decodeCardImage.test.ts`
- Modify: `cardova-backend/package.json` — add dependency `sharp`

**Interfaces:**
- Consumes: `RecognitionImage`, `ImageUploadError`
- Produces:

```ts
export const MAX_DECODED_PIXELS = 40_000_000;
export interface DecodedCardImage {
  width: number;
  height: number;
  channels: 3 | 4;
  pixels: Buffer;
  analysisJpeg: Buffer;
  metrics: ImageQualityMetrics;
}
export async function decodeCardImage(image: RecognitionImage): Promise<DecodedCardImage>
```

- [ ] **Step 1: Add sharp**

Run: `npm install sharp` in `cardova-backend`

- [ ] **Step 2: Write failing tests**

Use Sharp to synthesize tiny JPEGs in the test:

```ts
it("rejects a decoded image above 40 megapixels", async () => {
  const huge = await sharp({
    create: { width: 10000, height: 4001, channels: 3, background: { r: 120, g: 120, b: 120 } },
  })
    .jpeg()
    .toBuffer();
  await assert.rejects(
    decodeCardImage({ bytes: huge, mimeType: "image/jpeg" }),
    (error: unknown) => {
      assert.ok(error instanceof ImageUploadError);
      assert.equal(error.code, "image_too_large");
      assert.match((error as Error).message, /too large to analyze/i);
      return true;
    }
  );
});

it("returns luminance near 0 for a black image", async () => {
  const bytes = await sharp({
    create: { width: 64, height: 96, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .jpeg()
    .toBuffer();
  const decoded = await decodeCardImage({ bytes, mimeType: "image/jpeg" });
  assert.ok(decoded.metrics.meanLuminance < 10);
  assert.equal(decoded.width, 64);
  assert.equal(decoded.height, 96);
});
```

The 40 MP test is slow/memory-heavy. Prefer injecting width/height by exporting `assertDecodedPixelLimit(width, height)` and testing that pure function with `10000 x 4001`, while `decodeCardImage` calls it after `sharp().metadata()` **before** `.raw()`. Do **not** actually allocate 40 MP in tests.

```ts
export function assertDecodedPixelLimit(width: number, height: number): void {
  if (width * height > MAX_DECODED_PIXELS) {
    throw new ImageUploadError("image_too_large", "That photo is too large to analyze. Use a smaller image.");
  }
}
```

Also test Laplacian sharpness: a sharp black/white checkerboard scores higher than a solid gray field of the same size.

- [ ] **Step 3: Fail**
- [ ] **Step 4: Implement**

Pipeline: `sharp(bytes, { failOn: "error" }).rotate()` (EXIF), metadata, pixel limit, resize so max edge is 2000 for analysis (keep original dimensions in metrics from metadata after rotate), raw pixels for metrics, JPEG buffer for provider.

Metrics:

- `meanLuminance`: mean of `0.2126 R + 0.7152 G + 0.0722 B`
- `sharpness`: variance of a 3x3 Laplacian on luminance
- `glareCoverage`: share of pixels with all RGB >= 250
- `cardFillRatio`, `clippedCorner`, `perspectiveUnusable` start as `null`/`false` until boundary detection; decode may leave `cardFillRatio: null`

- [ ] **Step 5: Pass and commit** `feat: decode pre-grade images with pixel limits`

---

### Task 8: Outer card-boundary detection

**Files:**
- Create: `cardova-backend/src/imaging/cardBoundary.ts`
- Create: `cardova-backend/src/imaging/cardBoundary.test.ts`

**Interfaces:**
- Consumes: `DecodedCardImage`, `orderCardCorners`
- Produces:

```ts
export interface CardBoundary {
  corners: Point[];
  confidence: "high" | "low";
  fillRatio: number;
  clipped: boolean;
  perspectiveHeavy: boolean;
}
export function detectCardBoundary(image: DecodedCardImage): CardBoundary | null
```

- [ ] **Step 1: Failing tests with synthetic pixels**

Create a 200x280 gray background (`180,180,180`) with a 120x180 dark rectangle (`20,20,20`) inset. Expect four corners near the rectangle, `clipped === false`, `fillRatio` around `120*180/(200*280)`.

Create a rectangle that touches the image edge. Expect `clipped === true`.

Create uniform noise / no rectangle. Expect `null` or `confidence === "low"`.

Do not key off interior artwork: a white inner frame inside a dark card must still report the **outer** dark rectangle.

- [ ] **Step 2: Fail**
- [ ] **Step 3: Implement conservative detector**

Downsample luminance. Threshold against a border-sampled background. Find the largest 4-sided contour near aspect 2.5/3.5 (±35%). Order corners. `confidence` is `high` only if fill is between 0.45 and 0.92, quad is convex, and corners sit at least 2px inside the image. `perspectiveHeavy` if opposite-side length ratio > 1.35.

- [ ] **Step 4: Pass**
- [ ] **Step 5: Commit** `feat: detect physical card boundaries`

---

### Task 9: Normalization, crops, and inspection sheets

**Files:**
- Create: `cardova-backend/src/imaging/inspectionSheets.ts`
- Create: `cardova-backend/src/imaging/inspectionSheets.test.ts`

**Interfaces:**
- Produces:

```ts
export interface PreparedSide {
  role: CaptureRole;
  decoded: DecodedCardImage;
  quality: ImageQualityAssessment;
  boundary: CardBoundary | null;
  normalizedJpeg: Buffer | null;
  detailSheetJpeg: Buffer;
  centering: SideCentering;
}

export async function prepareSide(role: CaptureRole, image: RecognitionImage): Promise<PreparedSide>
```

`prepareSide` calls `decodeCardImage`, `detectCardBoundary`, updates metrics (`cardFillRatio`, `clippedCorner`, `perspectiveUnusable`), `classifyImageQuality`, optional warp to 700x980 JPEG when boundary confidence is high, then crops.

Corner crop: 18% of min(width,height) from each ordered corner on the normalized (or original) image.

Edge strip: 8% inset along each edge.

Compose a labeled detail sheet with Sharp: 2x2 corners plus four edge strips, text labels `FL` `FR` `BL` `BR` `T` `R` `B` `L`.

Printed-frame centering: on the normalized image, walk inward from each physical edge along the midline and find the first sustained contrast step (>= 25 luminance over 3 consecutive pixels, remaining stable). If not found, that border is `null`. Then `sideCenteringFromBorders`.

- [ ] **Step 1: Tests**

```ts
it("places corner crop origins at the four ordered corners", () => {
  const crops = cornerCropBoxes(
    [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 140 },
      { x: 0, y: 140 },
    ],
    100,
    140
  );
  assert.equal(crops.top_left.left, 0);
  assert.equal(crops.top_left.top, 0);
  assert.ok(crops.top_right.left > 50);
});

it("does not claim centering when contrast steps are missing", () => {
  const centering = measurePrintedFrame(
    solidPixels(50, 70, 128),
    50,
    70,
    3
  );
  assert.equal(centering.measurementAvailable, false);
});
```

Export `cornerCropBoxes` and `measurePrintedFrame` for unit tests so you are not asserting JPEG pixels.

- [ ] **Step 2: Fail**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Pass**
- [ ] **Step 5: Commit** `feat: prepare labeled pre-grade inspection sheets`

---

### Task 10: OpenAI mapper (no network)

**Files:**
- Create: `cardova-backend/src/preGrade/preGradeError.ts`
- Create: `cardova-backend/src/providers/openai/mapOpenAiPreGrade.ts`
- Create: `cardova-backend/src/providers/openai/mapOpenAiPreGrade.test.ts`

**Interfaces:**
- Produces:

```ts
export function mapOpenAiPreGrade(payload: unknown): ProviderPreGradeResult
```

`PreGradeError` codes: `"provider_unavailable" | "pregrade_timeout" | "provider_response"`

Messages: `"Pre-grade analysis is unavailable."`, `"Pre-grade analysis timed out."`, `"Pre-grade analysis returned an unexpected response."`

- [ ] **Step 1: Failing tests**

```ts
it("maps a valid structured payload to component assessments", () => {
  const mapped = mapOpenAiPreGrade(validPayload());
  assert.equal(mapped.corners.rating, "minor_concerns");
  assert.equal(mapped.findings[0]?.code, "corner_whitening");
  assert.equal(JSON.stringify(mapped).includes("gpt-"), false);
  assert.equal("id" in (mapped as object), false);
});

it("rejects an unknown finding code", () => {
  assert.throws(() => mapOpenAiPreGrade(validPayload({ code: "hairline_micro_scratch" })), (error: unknown) => {
    assert.ok(error instanceof PreGradeError);
    assert.equal(error.code, "provider_response");
    assert.equal(error.message.includes("hairline"), false);
    return true;
  });
});

it("rejects a finalGrade field from the provider", () => {
  assert.throws(() => mapOpenAiPreGrade({ ...validPayload(), finalGrade: 10 }), (error: unknown) => {
    assert.ok(error instanceof PreGradeError);
    assert.equal(error.code, "provider_response");
    return true;
  });
});

it("rejects descriptions longer than 180 characters", () => {
  assert.throws(() => mapOpenAiPreGrade(validPayload({ description: "x".repeat(181) })));
});
```

`validPayload()` shape (strict):

```ts
{
  corners: { rating: "minor_concerns", confidence: "high", findings: [] },
  edges: { rating: "strong", confidence: "high", findings: [] },
  surface: {
    rating: "strong",
    confidence: "moderate",
    findings: [],
    visibilityLimited: true
  },
  findings: [
    {
      code: "corner_whitening",
      severity: "minor",
      side: "back",
      location: "bottom_left",
      description: "Minor whitening on the back lower-left corner",
      evidence: "white fibers visible"
    }
  ],
  limitations: ["Flat photos may not reveal fine scratches."]
}
```

Allow at most 24 findings. Require enums from the domain. Drop unknown extra keys silently only at the **finding** level if you must; reject extra keys on the root object (`finalGrade`, `model`, `id`).

- [ ] **Step 2: Fail**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Pass**
- [ ] **Step 5: Commit** `feat: map OpenAI pre-grade findings without leaking provider fields`

---

### Task 11: OpenAI provider wrapper

**Files:**
- Create: `cardova-backend/src/providers/openai/openAiPreGradeProvider.ts`
- Create: `cardova-backend/src/providers/openai/openAiPreGradeProvider.test.ts`
- Modify: `cardova-backend/src/config/env.ts`
- Modify: `cardova-backend/.env.example`
- Modify: `cardova-backend/package.json` — add dependency `openai`

**Interfaces:**
- Produces:

```ts
export function createOpenAiPreGradeProvider(options?: {
  post?: (body: unknown) => Promise<unknown>;
  getConfig?: () => { apiKey: string; model: string } | null;
}): PreGradeProvider
```

`getOpenAiPreGradeConfig` lives in `cardova-backend/src/config/env.ts` and is the default `getConfig`.

Default model `"gpt-5.6"`. Timeout 45s.

- [ ] **Step 1: Failing tests**

```ts
it("does not call OpenAI when credentials are missing", async () => {
  let called = 0;
  const provider = createOpenAiPreGradeProvider({
    getConfig: () => null,
    post: async () => {
      called += 1;
      return {};
    },
  });
  await assert.rejects(provider.assess(sampleInput()), (error: unknown) => {
    assert.ok(error instanceof PreGradeError);
    assert.equal(error.code, "provider_unavailable");
    return true;
  });
  assert.equal(called, 0);
});

it("sends original image detail and structured json schema without uploading files", async () => {
  let body: any;
  const provider = createOpenAiPreGradeProvider({
    getConfig: () => ({ apiKey: "test-key", model: "gpt-5.6" }),
    post: async (payload) => {
      body = payload;
      return { output_text: JSON.stringify(validPayload()) };
    },
  });
  const result = await provider.assess(sampleInput());
  assert.equal(result.corners.rating, "minor_concerns");
  assert.equal(body.model, "gpt-5.6");
  const images = JSON.stringify(body).match(/input_image/g) || [];
  assert.ok(images.length >= 2);
  assert.match(JSON.stringify(body), /"detail":"original"/);
  assert.equal(JSON.stringify(body).includes("files.create"), false);
  assert.match(JSON.stringify(body), /json_schema/);
});

it("maps a timeout to pregrade_timeout without exposing the provider body", async () => {
  const provider = createOpenAiPreGradeProvider({
    getConfig: () => ({ apiKey: "test-key", model: "gpt-5.6" }),
    post: async () => {
      const error = new Error("aborted");
      error.name = "TimeoutError";
      throw error;
    },
  });
  await assert.rejects(provider.assess(sampleInput()), (error: unknown) => {
    assert.ok(error instanceof PreGradeError);
    assert.equal(error.code, "pregrade_timeout");
    assert.equal(error.message.includes("aborted"), false);
    return true;
  });
});
```

- [ ] **Step 2: Fail**
- [ ] **Step 3: Implement**

`env.ts`:

```ts
export function getOpenAiPreGradeConfig(): { apiKey: string; model: string } | null {
  const apiKey = readEnv("OPENAI_API_KEY");
  if (!apiKey) return null;
  return { apiKey, model: readEnv("OPENAI_PRE_GRADE_MODEL") || "gpt-5.6" };
}
```

`.env.example` adds:

```
OPENAI_API_KEY=
OPENAI_PRE_GRADE_MODEL=gpt-5.6
```

Prompt text (keep in the provider file) must include: inspect only visible defects; do not output a grade; do not claim hidden defects are absent; do not mention prices; use the finding allowlist; prefer “No major surface issue visible in this photo” over “No scratches.”

Images are `data:${mimeType};base64,...`.

Parse `output_text` or message text; then `mapOpenAiPreGrade`.

- [ ] **Step 4: Pass**
- [ ] **Step 5: Commit** `feat: add OpenAI pre-grade provider boundary`

---

### Task 12: Pre-grade service orchestration

**Files:**
- Create: `cardova-backend/src/services/preGradeService.ts`
- Create: `cardova-backend/src/services/preGradeService.test.ts`

**Interfaces:**
- Consumes: `Card` from `domain/card.ts`, `prepareSide`, `aggregatePreGrade`, `PreGradeProvider`
- Produces:

```ts
export function createPreGradeService(options: {
  provider: PreGradeProvider;
  prepare?: typeof prepareSide;
  now?: () => number;
  maxConcurrent?: number;
}): {
  assess(card: Card, images: { front: RecognitionImage; back: RecognitionImage }): Promise<PreGradeAssessment>;
}
```

Default `maxConcurrent = 2`. If exceeded, throw `PreGradeError("provider_unavailable", "Pre-grade analysis is busy. Try again in a moment.")` — later the route maps busy to 429. Prefer a dedicated code:

Add `"busy"` to `PreGradeError` codes and message `"Pre-grade analysis is busy. Try again in a moment."`

- [ ] **Step 1: Failing tests**

```ts
it("returns retake_required and does not call the provider when the front image is unusable", async () => {
  let called = 0;
  const service = createPreGradeService({
    provider: {
      id: "mock",
      async assess() {
        called += 1;
        return emptyProviderResult();
      },
    },
    prepare: async (role) => unusablePrepared(role, role === "front"),
  });
  const result = await service.assess(card, { front: jpegImage(), back: jpegImage() });
  assert.equal(result.status, "retake_required");
  assert.equal(result.estimatedGrade, null);
  assert.equal(result.confidence, null);
  assert.equal(called, 0);
  assert.ok(result.retakeInstructions && result.retakeInstructions.length > 0);
  assert.equal(isPreGradeAssessment(result), true);
});

it("derives the grade from the engine rather than the provider", async () => {
  const service = createPreGradeService({
    provider: {
      id: "mock",
      async assess() {
        return {
          corners: { rating: "strong", confidence: "high", findings: [] },
          edges: { rating: "strong", confidence: "high", findings: [] },
          surface: { rating: "strong", confidence: "high", findings: [] },
          findings: [],
          limitations: [],
        };
      },
    },
    prepare: async (role) => goodPrepared(role),
  });
  const result = await service.assess(card, { front: jpegImage(), back: jpegImage() });
  assert.equal(result.status, "complete");
  assert.deepEqual(result.estimatedGrade, { min: 9, max: 10 });
  assert.equal(Object.hasOwn(result, "soldComps"), false);
});

it("does not import or attach market data", async () => {
  const source = readFileSync(new URL("./preGradeService.ts", import.meta.url), "utf8");
  assert.equal(source.includes("marketService"), false);
  assert.equal(source.includes("soldComps"), false);
});
```

`unusablePrepared` / `goodPrepared` must return `PreparedSide` with quality ratings `unusable` vs `good`.

Logging: `console.info("pregrade request started", { cardId, frontBytes, backBytes, frontMime, backMime })` and a finished log with `status`, `latencyMs`, `confidence` — never bytes payload.

Always append limitation: `"Flat photos may not reveal fine scratches, indentations, pressure marks, subtle print lines, or texture issues."`

If `surface.rating === "strong"`, add finding-free limitation only (no “No scratches”).

Semantic conflict: if centering measurement exists and provider also emits `centering_left_right` with opposing severity, set `semanticConflict: true`.

- [ ] **Step 2: Fail**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Pass**
- [ ] **Step 5: Commit** `feat: orchestrate pre-grade analysis without market data`

---

### Task 13: HTTP route and server wiring

**Files:**
- Create: `cardova-backend/src/routes/preGrade.ts`
- Modify: `cardova-backend/server.js`
- Optional small route test if you can inject a mock service; otherwise cover via service tests plus a thin route mapping test file `src/routes/preGrade.test.ts`

**Interfaces:**
- Consumes: `parsePreGradeImages`, `createPreGradeService`, `cardService.getCard`, `ImageUploadError`, `PreGradeError`

- [ ] **Step 1: Write a mapping test** for status codes by exporting `preGradeHttpStatus(error)`:

```ts
assert.equal(preGradeHttpStatus(new ImageUploadError("invalid_upload", "x")), 400);
assert.equal(preGradeHttpStatus(new ImageUploadError("image_too_large", "x")), 413);
assert.equal(preGradeHttpStatus(new ImageUploadError("unsupported_type", "x")), 415);
assert.equal(preGradeHttpStatus(new PreGradeError("busy", "x")), 429);
assert.equal(preGradeHttpStatus(new PreGradeError("provider_response", "x")), 502);
assert.equal(preGradeHttpStatus(new PreGradeError("provider_unavailable", "x")), 503);
assert.equal(preGradeHttpStatus(new PreGradeError("pregrade_timeout", "x")), 504);
```

- [ ] **Step 2: Fail**
- [ ] **Step 3: Implement route**

```ts
router.post("/:id/pregrade", async (req, res) => {
  const card = await cardService.getCard(req.params.id);
  if (!card) {
    res.status(404).json({ error: "We could not find that card." });
    return;
  }
  const images = await parsePreGradeImages(req);
  const result = await preGrade.assess(card, images);
  res.json(result);
});
```

Mount in `server.js` as `app.use("/api/cards", createPreGradeRouter({ getCard, assess }))` **before** `GET /api/cards/:id` is fine because methods differ.

Construct:

```ts
const preGrade = createPreGradeService({
  provider: createOpenAiPreGradeProvider(),
});
```

Catch blocks match recognition: upload errors, `PreGradeError`, then 500 `"Pre-grade analysis failed."` without dumping `error.stack` to the client.

- [ ] **Step 4: Pass tests and `npx tsc --noEmit`**
- [ ] **Step 5: Commit** `feat: expose POST /api/cards/:id/pregrade`

---

### Task 14: Extract CameraCapture

**Files:**
- Create: `cardova/src/components/CameraCapture.jsx`
- Modify: `cardova/src/pages/Scan.jsx`

**Interfaces:**
- Produces: `<CameraCapture title onCapture onCancel guidance />` where `onCapture(file)` receives a JPEG/PNG/WebP `File`.

Props:

- `title` string
- `guidance` string
- `onCapture(file)`
- `onClose()`
- `captureLabel` default `"Take photo"`

Move camera, torch, overlay, choose-photo, and blob capture from `Scan.jsx`. Scan keeps identification POST logic and results UI.

- [ ] **Step 1: Refactor without behavior change**
- [ ] **Step 2: `npm run lint` in `cardova`**
- [ ] **Step 3: Commit** `refactor: extract shared camera capture`

There is no frontend unit-test harness; lint is the automated check.

---

### Task 15: Pre-grade wizard UI

**Files:**
- Create: `cardova/src/lib/grading.js`
- Create: `cardova/src/pages/PreGrade.jsx`
- Modify: `cardova/src/App.jsx`
- Modify: `cardova/src/pages/CardDetail.jsx`

**Interfaces:**
- `submitPreGrade(cardId, frontFile, backFile)` posts FormData fields `front` and `back` to `cardApiUrl(id, "/pregrade")`.
- Route `/card/:id/pregrade`
- Hide header when `location.pathname.includes("/pregrade")`

- [ ] **Step 1: Implement `grading.js`**

```js
import { cardApiUrl } from "./cards.js";

export function confidenceLabel(confidence) {
  if (confidence === "very_low") return "Assessment confidence: Very low";
  if (confidence === "low") return "Assessment confidence: Low";
  if (confidence === "moderate") return "Assessment confidence: Moderate";
  if (confidence === "high") return "Assessment confidence: High";
  return null;
}

export async function submitPreGrade(cardId, frontFile, backFile) {
  const body = new FormData();
  body.append("front", frontFile);
  body.append("back", backFile);
  const res = await fetch(cardApiUrl(cardId, "/pregrade"), { method: "POST", body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message || "We couldn't analyze those photos.");
  }
  return json;
}
```

- [ ] **Step 2: Implement `PreGrade.jsx` state machine**

Steps: `front | back | review | analyzing | results`

Front/back: `CameraCapture` plus the exact guidance:

`"Remove the card from a sleeve or toploader if you safely can. Use a clean flat background. Photograph straight above the card. Fill most of the frame. Avoid strong glare. Use good lighting. Keep all four edges and corners visible."`

Review: two labeled `<img alt="Front of card">` / `alt="Back of card"` previews, per-side Retake, Analyze.

Analyzing: `aria-live="polite"` `"Analyzing visible condition…"`

Results:

- heading `"Pre-Grade"`
- `"Estimated PSA-style range"` as `8–9` from `estimatedGrade.min`–`max`
- confidence label
- Centering / Corners / Edges / Surface blocks
- Visible concerns list from `findings`
- Limitations
- `"Retake Photos"` resets to `front`
- Close returns to `/card/:id`

For `status === "retake_required"`: show instructions, no range, Retake Photos.

Forbidden strings must not appear in the file: `Guaranteed`, `Official grade`, `PSA says`, `You will get`, `Grade This Card`.

- [ ] **Step 3: Card Detail button** after identity block, before `<SoldMarket />`:

```jsx
<Link
  to={`/card/${encodeURIComponent(card.id)}/pregrade`}
  className="mt-6 flex min-h-14 items-center justify-center rounded-2xl bg-black text-white font-bold text-lg"
>
  Analyze for Grading
</Link>
```

- [ ] **Step 4: App route**

```jsx
const hideHeader = location.pathname === "/scan" || location.pathname.includes("/pregrade");
...
<Route path="/card/:id/pregrade" element={<PreGrade />} />
<Route path="/card/:id" element={<CardDetail />} />
```

Pre-grade route must be registered **before** `/card/:id` only if they could clash; they do not, because paths differ.

- [ ] **Step 5: Lint and build**

Run in `cardova`: `npm run lint` then `npm run build`

Expected: both succeed.

- [ ] **Step 6: Commit** `feat: add pre-grade capture wizard`

---

### Task 16: Fixtures, gitignore, and milestone documentation

**Files:**
- Modify: `.gitignore`
- Create: `dev-fixtures/grading/.gitkeep`
- Create: `dev-fixtures/grading/README.md`
- Create: `docs/MILESTONE_4_AI_PRE_GRADE.md`

- [ ] **Step 1: Gitignore**

```
dev-fixtures/grading/*
!dev-fixtures/grading/.gitkeep
!dev-fixtures/grading/README.md
```

- [ ] **Step 2: README** lists the eight filenames from the spec and says images are local, rights-cleared, never committed.

- [ ] **Step 3: Write `docs/MILESTONE_4_AI_PRE_GRADE.md`** covering every documentation heading in the spec. Manual tests section must say **pending local fixture images** for:

- clean-looking modern card
- visible whitening
- visibly poor centering
- poor/glare-heavy photograph

Include a table template: image quality, centering, findings, grade range, assessment confidence, internally consistent (yes/no). Do not claim they passed.

Recommended next milestone: Grade-vs-Sell using actionable market medians from Milestone 3.5 plus this pre-grade range.

No secrets.

- [ ] **Step 4: Quality gates**

Backend: `npm test` then `npx tsc --noEmit`

Frontend: `npm run lint` then `npm run build`

- [ ] **Step 5: Browser verification** (no real OpenAI required if you temporarily inject a mock; otherwise use a real key only locally and never commit it)

Verify:

- Card Detail button
- Front → Back → Review → Analyze
- camera and choose-photo fallback
- retake per side
- retake_required copy
- complete results order
- mobile and desktop widths
- sold market still on Card Detail and not in the assessment

- [ ] **Step 6: Commit** `docs: record AI pre-grade milestone`

---

## Spec coverage

| Spec section | Task |
| --- | --- |
| Domain model / findings | 1 |
| Upload / MIME / size | 2, 7 |
| Image-quality gate | 3, 7, 12 |
| Geometry / crop | 4, 8, 9 |
| Centering | 5, 9 |
| Grade range / ceilings / confidence | 6, 12 |
| OpenAI boundary / no leak | 10, 11 |
| Service skip provider / no market | 12 |
| API | 13 |
| UI wizard | 14, 15 |
| Fixtures, docs, gates | 16 |
| Retention / no disk | 2, 11, 12 (in-memory only) |
| Concurrency 429 | 12, 13 |

## Placeholder scan

No TBD / TODO / “implement later” steps remain. Frontend has no unit-test runner; Task 14–15 use lint/build as specified in the design.

## Type consistency

Names locked across tasks: `parsePreGradeImages`, `classifyImageQuality`, `orderCardCorners`, `perspectiveMap`, `axisRatio`, `sideCenteringFromBorders`, `aggregatePreGrade`, `decodeCardImage`, `detectCardBoundary`, `prepareSide`, `mapOpenAiPreGrade`, `createOpenAiPreGradeProvider`, `createPreGradeService`, `submitPreGrade`.
