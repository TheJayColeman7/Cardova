import { isSoldComp, type SoldComp } from "./market.js";

export const MARKET_WINDOW_DAYS = 90;
export const SUMMARY_SALE_COUNT = 3;

export type MarketEvidence = "none" | "single" | "limited" | "summary";

export interface LatestSale {
  soldPrice: number;
  soldAt: string | null;
}

export interface MarketBucketSummary {
  saleCount: number;
  evidence: MarketEvidence;
  currency: "USD";
  latestSale: LatestSale | null;
  minimum: number | null;
  maximum: number | null;
  median: number | null;
  mean: number | null;
  condition: string | null;
  mixedConditions: boolean;
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
  raw: MarketBucketSummary;
  grades: Record<string, Record<string, MarketBucketSummary>>;
}

const HIGHLIGHT_GRADES = ["8", "9", "10"] as const;

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

function emptyBucket(): MarketBucketSummary {
  return {
    saleCount: 0,
    evidence: "none",
    currency: "USD",
    latestSale: null,
    minimum: null,
    maximum: null,
    median: null,
    mean: null,
    condition: null,
    mixedConditions: false,
  };
}

function evidenceFor(count: number): MarketEvidence {
  if (count <= 0) return "none";
  if (count === 1) return "single";
  if (count < SUMMARY_SALE_COUNT) return "limited";
  return "summary";
}

function companyKey(value: string): string {
  const trimmed = value.trim();
  const upper = trimmed.toUpperCase();
  if (upper === "PSA" || upper === "BGS" || upper === "CGC" || upper === "TAG") return upper;
  return trimmed;
}

function gradeKey(value: string): string {
  const trimmed = value.trim();
  if (/^\d+(\.0+)?$/.test(trimmed)) return String(Number(trimmed));
  return trimmed;
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
  if (evidence === "none" || evidence === "single") return bucket;
  bucket.minimum = Math.min(...prices);
  bucket.maximum = Math.max(...prices);
  bucket.median = median(prices);
  bucket.mean = mean(prices);
  return bucket;
}

function isGraded(comp: SoldComp): boolean {
  return Boolean(comp.gradingCompany || comp.grade);
}

export function distinctVariants(comps: SoldComp[]): string[] {
  return [...new Set(comps.map((comp) => comp.variant).filter((value): value is string => Boolean(value)))].sort();
}

export function summarizeSoldComps(comps: SoldComp[]): GradeMarketSummaries {
  const raw = comps.filter((comp) => !isGraded(comp));
  const grades: Record<string, Record<string, MarketBucketSummary>> = {
    PSA: {
      "8": emptyBucket(),
      "9": emptyBucket(),
      "10": emptyBucket(),
    },
  };

  const psa = grades.PSA ?? {};
  grades.PSA = psa;
  for (const grade of HIGHLIGHT_GRADES) {
    psa[grade] = summarizeBucket(
      comps.filter((comp) => comp.gradingCompany && companyKey(comp.gradingCompany) === "PSA" && comp.grade && gradeKey(comp.grade) === grade)
    );
  }

  for (const comp of comps) {
    if (!isGraded(comp)) continue;
    const company = comp.gradingCompany ? companyKey(comp.gradingCompany) : "Unspecified";
    const grade = comp.grade ? gradeKey(comp.grade) : "unknown";
    if (company === "PSA" && (grade === "8" || grade === "9" || grade === "10")) continue;
    const companyGrades = grades[company] ?? {};
    const group = comps.filter(
      (item) =>
        item.gradingCompany &&
        companyKey(item.gradingCompany) === company &&
        item.grade &&
        gradeKey(item.grade) === grade
    );
    companyGrades[grade] = summarizeBucket(group);
    grades[company] = companyGrades;
  }

  return { raw: summarizeBucket(raw), grades };
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
