import {
  evaluateCompQuality,
  isRawCondition,
  RAW_CONDITIONS,
  soldCompBucket,
  type CompCardIdentity,
  type EvaluatedSoldComp,
  type RawCondition,
} from "./compQuality.js";
import { isSoldComp, type SoldComp } from "./market.js";

export const MARKET_WINDOW_DAYS = 90;
export const SUMMARY_SALE_COUNT = 3;
export const RAW_HEADLINE_MIN_SALES = 3;
export const RAW_HEADLINE_SHARE = 0.8;
const CONFIDENCE_SAMPLE_FLOOR = 5;
const STRONG_SALE_COUNT = 15;

export type MarketEvidence = "none" | "single" | "limited" | "summary";
export type EvidenceConfidence = "none" | "very_low" | "low" | "moderate" | "strong";

export interface LatestSale {
  soldPrice: number;
  soldAt: string | null;
}

export interface ObservedPriceStats {
  saleCount: number;
  minimum: number | null;
  maximum: number | null;
  median: number | null;
  mean: number | null;
}

export interface BucketQualityCounts {
  included: number;
  warned: number;
  excluded: number;
}

export interface MarketBucketSummary {
  saleCount: number;
  evidence: MarketEvidence;
  confidence: EvidenceConfidence;
  currency: "USD";
  latestSale: LatestSale | null;
  minimum: number | null;
  maximum: number | null;
  median: number | null;
  mean: number | null;
  condition: string | null;
  mixedConditions: boolean;
  allObserved: ObservedPriceStats;
  quality: BucketQualityCounts;
}

export interface MarketExclusions {
  missingPrice: number;
  nonPositivePrice: number;
  nonUsd: number;
  outsideWindow: number;
  missingDate: number;
  notSoldComp: number;
}

export interface GradeMarketSummaries {
  raw: MarketBucketSummary | null;
  rawSelectionRequired: boolean;
  rawConditions: Record<RawCondition, MarketBucketSummary>;
  grades: Record<string, Record<string, MarketBucketSummary>>;
}

export interface SummaryOptions {
  identity?: CompCardIdentity;
  windowComplete?: boolean;
  now?: Date;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? null;
  const lower = sorted[middle - 1];
  const upper = sorted[middle];
  if (lower === undefined || upper === undefined) return null;
  return (lower + upper) / 2;
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function emptyObserved(): ObservedPriceStats {
  return { saleCount: 0, minimum: null, maximum: null, median: null, mean: null };
}

function emptyBucket(): MarketBucketSummary {
  return {
    saleCount: 0,
    evidence: "none",
    confidence: "none",
    currency: "USD",
    latestSale: null,
    minimum: null,
    maximum: null,
    median: null,
    mean: null,
    condition: null,
    mixedConditions: false,
    allObserved: emptyObserved(),
    quality: { included: 0, warned: 0, excluded: 0 },
  };
}

function evidenceFor(count: number): MarketEvidence {
  if (count <= 0) return "none";
  if (count === 1) return "single";
  if (count < SUMMARY_SALE_COUNT) return "limited";
  return "summary";
}

function soldTime(value: string | null): number {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

export function summarizeBucket(comps: SoldComp[]): MarketBucketSummary {
  const prices = comps
    .map((comp) => comp.soldPrice)
    .filter((price): price is number => typeof price === "number" && price > 0);
  const evidence = evidenceFor(prices.length);
  const latest = [...comps].sort((left, right) => soldTime(right.soldAt) - soldTime(left.soldAt))[0];
  const conditions = [...new Set(comps.map((comp) => comp.condition).filter((value): value is string => Boolean(value)))];
  const bucket = emptyBucket();
  bucket.saleCount = prices.length;
  bucket.evidence = evidence;
  bucket.mixedConditions = conditions.length > 1;
  bucket.condition = conditions.length === 1 ? conditions[0] ?? null : null;
  if (latest && typeof latest.soldPrice === "number" && latest.soldPrice > 0) {
    bucket.latestSale = { soldPrice: latest.soldPrice, soldAt: latest.soldAt };
  }
  bucket.allObserved = observedStats(comps);
  bucket.quality = { included: prices.length, warned: 0, excluded: 0 };
  bucket.confidence = confidenceFromCount(prices.length);
  if (evidence === "none" || evidence === "single") return bucket;
  bucket.minimum = Math.min(...prices);
  bucket.maximum = Math.max(...prices);
  bucket.median = median(prices);
  bucket.mean = mean(prices);
  return bucket;
}

function observedStats(comps: SoldComp[]): ObservedPriceStats {
  const prices = comps
    .map((comp) => comp.soldPrice)
    .filter((price): price is number => typeof price === "number" && price > 0);
  if (prices.length === 0) return emptyObserved();
  return {
    saleCount: prices.length,
    minimum: Math.min(...prices),
    maximum: Math.max(...prices),
    median: median(prices),
    mean: mean(prices),
  };
}

function confidenceFromCount(count: number): EvidenceConfidence {
  if (count <= 0) return "none";
  if (count === 1) return "very_low";
  if (count < CONFIDENCE_SAMPLE_FLOOR) return "low";
  if (count < STRONG_SALE_COUNT) return "moderate";
  return "strong";
}

function downgrade(level: "low" | "moderate" | "strong"): "low" | "moderate" | "strong" {
  if (level === "strong") return "moderate";
  if (level === "moderate") return "low";
  return "low";
}

function ageDays(soldAt: string | null, now: Date): number | null {
  if (!soldAt) return null;
  const time = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(soldAt) ? `${soldAt}T00:00:00.000Z` : soldAt);
  if (!Number.isFinite(time)) return null;
  return (now.getTime() - time) / 86_400_000;
}

export function evidenceConfidence(input: {
  actionableCount: number;
  warningCount: number;
  windowComplete: boolean;
  minimum: number | null;
  maximum: number | null;
  median: number | null;
  latestSoldAt: string | null;
  now: Date;
}): EvidenceConfidence {
  const count = input.actionableCount;
  if (count <= 0) return "none";
  if (count === 1) return "very_low";
  if (count < CONFIDENCE_SAMPLE_FLOOR) return "low";

  let level: "low" | "moderate" | "strong" = count >= STRONG_SALE_COUNT ? "strong" : "moderate";
  const warningHeavy = input.warningCount >= Math.ceil(count * 0.25);
  const wide =
    input.median != null &&
    input.median > 0 &&
    input.minimum != null &&
    input.maximum != null &&
    (input.maximum - input.minimum) / input.median > 0.75;
  const age = ageDays(input.latestSoldAt, input.now);
  if (!input.windowComplete) level = downgrade(level);
  if (warningHeavy) level = downgrade(level);
  if (wide) level = downgrade(level);
  if (age != null && age > 60) level = downgrade(level);
  return level;
}

export function distinctVariants(comps: SoldComp[]): string[] {
  return [...new Set(comps.map((comp) => comp.variant).filter((value): value is string => Boolean(value)))].sort();
}

const EMPTY_IDENTITY: CompCardIdentity = {
  name: "",
  setName: null,
  cardNumber: null,
  language: null,
  variant: null,
};

function emptyRawConditions(): Record<RawCondition, MarketBucketSummary> {
  return {
    NM: emptyBucket(),
    LP: emptyBucket(),
    MP: emptyBucket(),
    HP: emptyBucket(),
    DMG: emptyBucket(),
    Unknown: emptyBucket(),
  };
}

function buildMarketBucket(items: EvaluatedSoldComp[], now: Date, windowComplete: boolean): MarketBucketSummary {
  const observed = items
    .filter((item) => !item.flags.some((itemFlag) => itemFlag.code === "duplicate_listing"))
    .map((item) => item.comp);
  const actionable = items.filter((item) => item.disposition !== "excluded").map((item) => item.comp);
  const bucket = summarizeBucket(actionable);
  bucket.allObserved = observedStats(observed);
  bucket.quality = {
    included: items.filter((item) => item.disposition === "included").length,
    warned: items.filter((item) => item.disposition === "warning").length,
    excluded: items.filter((item) => item.disposition === "excluded").length,
  };
  bucket.confidence = evidenceConfidence({
    actionableCount: bucket.saleCount,
    warningCount: bucket.quality.warned,
    windowComplete,
    minimum: bucket.minimum,
    maximum: bucket.maximum,
    median: bucket.median,
    latestSoldAt: bucket.latestSale?.soldAt ?? null,
    now,
  });
  return bucket;
}

function rawHeadline(conditions: Record<RawCondition, MarketBucketSummary>): {
  raw: MarketBucketSummary | null;
  rawSelectionRequired: boolean;
} {
  const present = RAW_CONDITIONS.filter((key) => conditions[key].allObserved.saleCount > 0);
  if (present.length === 0) return { raw: emptyBucket(), rawSelectionRequired: false };

  const actionable = present.filter((key) => conditions[key].saleCount > 0);
  if (actionable.length === 0) return { raw: null, rawSelectionRequired: true };
  if (actionable.length === 1) {
    const only = actionable[0];
    if (!only) return { raw: null, rawSelectionRequired: true };
    return { raw: conditions[only], rawSelectionRequired: false };
  }

  const total = actionable.reduce((sum, key) => sum + conditions[key].saleCount, 0);
  const ranked = [...actionable].sort((left, right) => conditions[right].saleCount - conditions[left].saleCount);
  const top = ranked[0];
  if (!top || total <= 0) return { raw: null, rawSelectionRequired: true };
  const share = conditions[top].saleCount / total;
  if (conditions[top].saleCount >= RAW_HEADLINE_MIN_SALES && share >= RAW_HEADLINE_SHARE) {
    return { raw: conditions[top], rawSelectionRequired: false };
  }
  return { raw: null, rawSelectionRequired: true };
}

export function summarizeSoldComps(comps: SoldComp[], options: SummaryOptions = {}): GradeMarketSummaries {
  const identity = options.identity ?? EMPTY_IDENTITY;
  const now = options.now ?? new Date();
  const windowComplete = options.windowComplete ?? true;
  const evaluated = evaluateCompQuality(comps, identity);
  const rawConditions = emptyRawConditions();
  const grades: Record<string, Record<string, MarketBucketSummary>> = {
    PSA: { "8": emptyBucket(), "9": emptyBucket(), "10": emptyBucket() },
  };
  const groups = new Map<string, EvaluatedSoldComp[]>();

  for (const item of evaluated) {
    const bucket = soldCompBucket(item.comp);
    const key = bucket.kind === "raw" ? `raw:${bucket.condition}` : `grade:${bucket.company}:${bucket.grade}`;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }

  for (const items of groups.values()) {
    const first = items[0];
    if (!first) continue;
    const descriptor = soldCompBucket(first.comp);
    const summary = buildMarketBucket(items, now, windowComplete);
    if (descriptor.kind === "raw") {
      if (!isRawCondition(descriptor.condition)) continue;
      summary.condition = descriptor.condition;
      summary.mixedConditions = false;
      rawConditions[descriptor.condition] = summary;
      continue;
    }
    const companyGrades = grades[descriptor.company] ?? {};
    companyGrades[descriptor.grade] = summary;
    grades[descriptor.company] = companyGrades;
  }

  return { ...rawHeadline(rawConditions), rawConditions, grades };
}

export function usdSoldComps(comps: SoldComp[], now = new Date(), windowDays = MARKET_WINDOW_DAYS): {
  included: SoldComp[];
  otherCurrency: SoldComp[];
  exclusions: MarketExclusions;
} {
  const exclusions: MarketExclusions = {
    missingPrice: 0,
    nonPositivePrice: 0,
    nonUsd: 0,
    outsideWindow: 0,
    missingDate: 0,
    notSoldComp: 0,
  };
  const included: SoldComp[] = [];
  const otherCurrency: SoldComp[] = [];
  const cutoff = now.getTime() - windowDays * 24 * 60 * 60 * 1000;

  for (const comp of comps) {
    if (!isSoldComp(comp)) {
      exclusions.notSoldComp += 1;
      continue;
    }
    if (comp.soldPrice == null) {
      exclusions.missingPrice += 1;
      continue;
    }
    if (!(comp.soldPrice > 0)) {
      exclusions.nonPositivePrice += 1;
      continue;
    }
    if (!comp.soldAt) {
      exclusions.missingDate += 1;
      continue;
    }
    const soldTime = Date.parse(comp.soldAt);
    if (!Number.isFinite(soldTime) || soldTime < cutoff) {
      exclusions.outsideWindow += 1;
      continue;
    }
    if ((comp.currency ?? "").toUpperCase() !== "USD") {
      exclusions.nonUsd += 1;
      otherCurrency.push(comp);
      continue;
    }
    included.push(comp);
  }

  return { included, otherCurrency, exclusions };
}
