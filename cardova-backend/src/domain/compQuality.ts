import { isSoldComp, type SoldComp } from "./market.js";

export const EXTREME_PRICE_MIN_SALES = 5;
export const RAW_CONDITIONS = ["NM", "LP", "MP", "HP", "DMG", "Unknown"] as const;

export type RawCondition = (typeof RAW_CONDITIONS)[number];
export type CompSeverity = "warning" | "exclude";
export type CompDisposition = "included" | "warning" | "excluded";

export type CompFlagCode =
  | "wrong_language"
  | "title_set_conflict"
  | "title_card_number_conflict"
  | "title_name_conflict"
  | "variant_conflict"
  | "grade_conflict"
  | "company_conflict"
  | "lot_or_bundle"
  | "sealed_product"
  | "damaged"
  | "signed"
  | "error_card"
  | "extreme_price"
  | "duplicate_listing";

export interface CompQualityFlag {
  code: CompFlagCode;
  severity: CompSeverity;
  reason: string;
}

export interface CompCardIdentity {
  name: string;
  setName: string | null;
  cardNumber: string | null;
  language: string | null;
  variant: string | null;
}

export interface EvaluatedSoldComp {
  comp: SoldComp;
  flags: CompQualityFlag[];
  disposition: CompDisposition;
}

export interface QualitySummary {
  included: number;
  warned: number;
  excluded: number;
  exclusionReasons: { code: CompFlagCode; count: number; reason: string }[];
}

export type SoldCompBucket =
  | { kind: "raw"; condition: RawCondition }
  | { kind: "grade"; company: string; grade: string };

interface PriceBounds {
  lower: number;
  upper: number;
}

const FLAG_TEXT: Record<CompFlagCode, { severity: CompSeverity; reason: string }> = {
  wrong_language: { severity: "exclude", reason: "Listing title names a different language" },
  title_set_conflict: { severity: "exclude", reason: "Listing title names a different set" },
  title_card_number_conflict: { severity: "exclude", reason: "Listing title names a different card number" },
  title_name_conflict: { severity: "exclude", reason: "Listing title says this is not the confirmed card" },
  variant_conflict: { severity: "exclude", reason: "Listing title names a different variant" },
  grade_conflict: { severity: "exclude", reason: "Listing title names a different grade" },
  company_conflict: { severity: "exclude", reason: "Listing title names a different grading company" },
  lot_or_bundle: { severity: "exclude", reason: "Listing title indicates multiple cards" },
  sealed_product: { severity: "exclude", reason: "Listing title indicates a sealed product" },
  damaged: { severity: "warning", reason: "Listing title indicates damage that the condition field does not" },
  signed: { severity: "exclude", reason: "Listing is marked signed" },
  error_card: { severity: "exclude", reason: "Listing is marked as an error card" },
  extreme_price: { severity: "warning", reason: "Price is far outside the rest of this bucket" },
  duplicate_listing: { severity: "exclude", reason: "Same listing id appears more than once" },
};

const LANGUAGE_WORDS: { language: string; pattern: RegExp }[] = [
  { language: "japanese", pattern: /\b(japanese|japan|jpn|jp)\b/i },
  { language: "korean", pattern: /\b(korean|korea|kor)\b/i },
  { language: "chinese", pattern: /\b(chinese|china)\b/i },
  { language: "german", pattern: /\b(german|deutsch)\b/i },
  { language: "french", pattern: /\b(french|francais|français)\b/i },
  { language: "italian", pattern: /\b(italian|italiano)\b/i },
  { language: "spanish", pattern: /\b(spanish|espanol|español)\b/i },
  { language: "portuguese", pattern: /\b(portuguese|portugues|português)\b/i },
  { language: "english", pattern: /\benglish\b/i },
];

const LOT_PATTERNS: RegExp[] = [
  /\bmixed lot\b/i,
  /\blot of\b/i,
  /\bcard lot\b/i,
  /(?<!\ba\s)\blots?\b/i,
  /\bbundle\b/i,
  /\bset of\s+\d+\b/i,
  /\bplayset\b/i,
  /\bmultiple cards\b/i,
  /\b(?:[2-9]|[1-9]\d+)\s+cards\b/i,
  /\b(?:[2-9]|[1-9]\d+)\s*x\b/i,
  /\bx\s*(?:[2-9]|[1-9]\d+)\b/i,
  /\b(?:entire collection|card collection|collection of)\b/i,
];

const NAME_STOPWORDS = new Set([
  "base",
  "set",
  "unlimited",
  "shadowless",
  "edition",
  "english",
  "japanese",
  "rare",
  "holo",
  "holofoil",
  "foil",
  "the",
  "of",
  "coast",
  "wizards",
  "pokemon",
  "tcg",
  "card",
  "cards",
  "promo",
  "reverse",
  "cosmos",
  "metal",
  "first",
  "gem",
  "mint",
  "graded",
  "psa",
  "bgs",
  "cgc",
  "sgc",
  "tag",
  "stage",
  "shiny",
  "secret",
  "illustration",
  "special",
  "art",
]);

const SEALED_PATTERNS: RegExp[] = [
  /\bbooster box\b/i,
  /\bbooster pack\b/i,
  /\belite trainer box\b/i,
  /\betb\b/i,
  /\bsealed box\b/i,
  /\bfactory sealed\b/i,
  /\bsealed product\b/i,
];

const RAW_CONDITION_ALIASES: Record<string, RawCondition> = {
  nm: "NM",
  "near mint": "NM",
  "near mint or better": "NM",
  mint: "NM",
  lp: "LP",
  "lightly played": "LP",
  "light play": "LP",
  mp: "MP",
  "moderately played": "MP",
  "moderate play": "MP",
  hp: "HP",
  "heavily played": "HP",
  "heavy play": "HP",
  dmg: "DMG",
  damaged: "DMG",
  poor: "DMG",
};

function flag(code: CompFlagCode, reason?: string): CompQualityFlag {
  const base = FLAG_TEXT[code];
  return { code, severity: base.severity, reason: reason ?? base.reason };
}

function pushFlag(flags: CompQualityFlag[], next: CompQualityFlag): void {
  if (flags.some((item) => item.code === next.code)) return;
  flags.push(next);
}

export function companyKey(value: string): string {
  const trimmed = value.trim();
  const upper = trimmed.toUpperCase();
  if (upper === "PSA" || upper === "BGS" || upper === "CGC" || upper === "TAG") return upper;
  return trimmed;
}

export function gradeKey(value: string): string {
  const trimmed = value.trim();
  if (/^\d+(\.0+)?$/.test(trimmed)) return String(Number(trimmed));
  return trimmed;
}

export function normalizeRawCondition(condition: string | null): RawCondition {
  if (!condition?.trim()) return "Unknown";
  const cleaned = condition.trim().toLowerCase().replace(/[_/-]+/g, " ").replace(/\s+/g, " ");
  return RAW_CONDITION_ALIASES[cleaned] ?? "Unknown";
}

export function isRawCondition(value: string): value is RawCondition {
  return (RAW_CONDITIONS as readonly string[]).includes(value);
}

export function soldCompBucket(comp: SoldComp): SoldCompBucket {
  if (!comp.gradingCompany && !comp.grade) {
    return { kind: "raw", condition: normalizeRawCondition(comp.condition) };
  }
  return {
    kind: "grade",
    company: comp.gradingCompany ? companyKey(comp.gradingCompany) : "Unspecified",
    grade: comp.grade ? gradeKey(comp.grade) : "unknown",
  };
}

function soldCompBucketKey(comp: SoldComp): string {
  const bucket = soldCompBucket(comp);
  if (bucket.kind === "raw") return `raw:${bucket.condition}`;
  return `grade:${bucket.company}:${bucket.grade}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function canonicalLanguage(value: string | null): string | null {
  if (!value?.trim()) return null;
  const cleaned = value.trim().toLowerCase();
  if (["en", "eng", "english"].includes(cleaned)) return "english";
  if (["ja", "jp", "jpn", "japanese"].includes(cleaned)) return "japanese";
  if (["ko", "kor", "korean"].includes(cleaned)) return "korean";
  if (["zh", "cn", "chinese"].includes(cleaned)) return "chinese";
  if (["de", "german", "deutsch"].includes(cleaned)) return "german";
  if (["fr", "french", "francais"].includes(cleaned)) return "french";
  if (["it", "italian"].includes(cleaned)) return "italian";
  if (["es", "spanish", "espanol"].includes(cleaned)) return "spanish";
  if (["pt", "portuguese", "portugues"].includes(cleaned)) return "portuguese";
  return cleaned;
}

function languagesInTitle(title: string): string[] {
  return LANGUAGE_WORDS.filter((item) => item.pattern.test(title)).map((item) => item.language);
}

function normalizeNumber(value: string): string {
  const match = /^0*(\d+)([a-z]*)$/i.exec(value.trim());
  if (!match?.[1]) return value.trim().toLowerCase();
  return `${Number(match[1])}${match[2]?.toLowerCase() ?? ""}`;
}

function explicitCardNumbers(title: string): string[] {
  const found = new Set<string>();
  const add = (value: string | undefined) => {
    if (!value) return;
    found.add(normalizeNumber(value));
  };
  for (const match of title.matchAll(/#\s*(\d{1,3})(?!\d)([a-z])?\b/gi)) {
    add(`${match[1] ?? ""}${match[2] ?? ""}`);
  }
  for (const match of title.matchAll(/\b(\d{1,3})\s*\/\s*(\d{2,3})(?!\d)/g)) {
    add(match[1]);
  }
  for (const match of title.matchAll(/\bno\.?\s*(\d{1,3})(?!\d)([a-z])?\b/gi)) {
    add(`${match[1] ?? ""}${match[2] ?? ""}`);
  }
  return [...found];
}

function setAliases(setName: string): string[] {
  const name = setName.trim().toLowerCase();
  if (name === "base" || name === "base set") return ["base set", "base"];
  return [name];
}

function contradictsSet(title: string, setName: string | null): boolean {
  if (!setName?.trim()) return false;
  const confirmed = setName.trim().toLowerCase();
  const numbered = /\b2\b/.test(confirmed) || confirmed.endsWith(" ii");
  if (!numbered) {
    for (const alias of setAliases(confirmed)) {
      const pattern = new RegExp(`\\b${escapeRegExp(alias)}\\s+(2|ii)\\b`, "i");
      if (pattern.test(title)) return true;
    }
  }
  if ((confirmed === "base" || confirmed === "base set") && /\blegendary collection\b/i.test(title)) return true;
  return false;
}

function titleToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function conflictingNameToken(title: string, name: string): boolean {
  const confirmed = name.trim().toLowerCase();
  if (confirmed.length < 3 || title.toLowerCase().includes(confirmed)) return false;
  const markers = [
    /\bholo(?:foil)?\b/i,
    /([A-Za-z][A-Za-z'-]{2,})\s+(?:#\s*\d{1,3}(?!\d)|\d{1,3}\s*\/\s*\d{2,3}(?!\d))/,
  ];
  for (const marker of markers) {
    const match = marker.exec(title);
    if (!match || match.index == null) continue;
    const tokenSource = match[1] ?? title.slice(0, match.index).trim().split(/\s+/).at(-1) ?? "";
    const token = titleToken(tokenSource);
    if (token.length < 4 || /^\d+$/.test(token) || NAME_STOPWORDS.has(token)) continue;
    if (confirmed.includes(token) || token.includes(confirmed.replace(/[^a-z0-9]/g, ""))) continue;
    return true;
  }
  return false;
}

function contradictsNumber(title: string, cardNumber: string | null): boolean {
  if (!cardNumber?.trim()) return false;
  const explicit = explicitCardNumbers(title);
  if (explicit.length === 0) return false;
  const confirmed = normalizeNumber(cardNumber);
  return explicit.every((value) => value !== confirmed);
}

function multipleDistinctCardNumbers(title: string): boolean {
  const numbers = [...title.matchAll(/#\s*(\d{1,3})(?!\d)/g)].map((match) => normalizeNumber(match[1] ?? ""));
  return new Set(numbers.filter((value) => value.length > 0)).size >= 2;
}

function titleIndicatesLot(title: string): boolean {
  return LOT_PATTERNS.some((pattern) => pattern.test(title)) || multipleDistinctCardNumbers(title);
}

function titleIndicatesSealed(title: string): boolean {
  return SEALED_PATTERNS.some((pattern) => pattern.test(title));
}

function titleIndicatesDamage(title: string): boolean {
  if (/\bno damage\b/i.test(title)) return false;
  return /\b(damaged|creased|water damage)\b/i.test(title);
}

function titleIndicatesSigned(title: string): boolean {
  if (/\bunsigned\b/i.test(title)) return false;
  return /\b(signed|autograph(?:ed)?)\b/i.test(title);
}

function titleIndicatesError(title: string): boolean {
  return /\b(misprint|miscut|error card)\b/i.test(title);
}

function gradeMentions(title: string): { company: string; grade: string }[] {
  const mentions: { company: string; grade: string }[] = [];
  for (const match of title.matchAll(/\b(PSA|BGS|CGC|SGC|TAG|ACE|GMA|HGA)\s*(\d+(?:\.\d+)?)\b/gi)) {
    const company = match[1];
    const grade = match[2];
    if (!company || !grade) continue;
    mentions.push({ company: companyKey(company), grade: gradeKey(grade) });
  }
  return mentions;
}

function variantConflictReason(title: string, variant: string | null): string | null {
  if (!variant) return null;
  const hasFirst = /\b(1st|first)\s+ed(?:ition)?\b/i.test(title);
  const hasUnlimited = /\bunlimited\b/i.test(title);
  const hasShadowless = /\bshadowless\b/i.test(title);
  const hasReverse = /\breverse\s+holo(?:foil)?\b/i.test(title);
  const hasNonHolo = /\bnon[-\s]?holo(?:foil)?\b/i.test(title);
  const variantFirst = /firstedition/i.test(variant);
  const variantUnlimited = /unlimited/i.test(variant);
  const variantShadowless = /shadowless/i.test(variant);
  const variantReverse = /reverse/i.test(variant);
  const variantHolo = /holo/i.test(variant) && !variantReverse;
  const variantNormal = /^normal$/i.test(variant) || /nonholo/i.test(variant);

  if (variantUnlimited && hasFirst) return "Listing title says first edition";
  if (variantFirst && hasUnlimited && !hasFirst) return "Listing title says unlimited";
  if (!variantShadowless && hasShadowless) return "Listing title says shadowless";
  if (variantHolo && hasReverse) return "Listing title says reverse holo";
  if ((variantHolo || variantReverse) && hasNonHolo) return "Listing title says non-holo";
  if (variantNormal && /\bholo(?:foil)?\b/i.test(title) && !hasNonHolo) return "Listing title says holo";
  return null;
}

function contentFlags(comp: SoldComp, identity: CompCardIdentity): CompQualityFlag[] {
  const flags: CompQualityFlag[] = [];
  const title = comp.title ?? "";
  const confirmedLanguage = canonicalLanguage(identity.language);
  if (confirmedLanguage && title) {
    const stated = languagesInTitle(title);
    if (stated.some((language) => language !== confirmedLanguage)) {
      pushFlag(flags, flag("wrong_language"));
    }
  }
  if (title && contradictsSet(title, identity.setName)) {
    pushFlag(flags, flag("title_set_conflict"));
  }
  if (title && contradictsNumber(title, identity.cardNumber)) {
    pushFlag(flags, flag("title_card_number_conflict"));
  }
  const name = identity.name.trim();
  if (name.length >= 3 && new RegExp(`\\bnot\\s+${escapeRegExp(name)}\\b`, "i").test(title)) {
    pushFlag(flags, flag("title_name_conflict"));
  }
  if (title && conflictingNameToken(title, identity.name)) {
    pushFlag(flags, flag("title_name_conflict", "Listing title names a different card"));
  }
  const variantReason = variantConflictReason(title, identity.variant);
  if (variantReason) pushFlag(flags, flag("variant_conflict", variantReason));
  if (titleIndicatesLot(title)) pushFlag(flags, flag("lot_or_bundle"));
  if (titleIndicatesSealed(title)) pushFlag(flags, flag("sealed_product"));

  const providerCompany = comp.gradingCompany ? companyKey(comp.gradingCompany) : null;
  const providerGrade = comp.grade ? gradeKey(comp.grade) : null;
  const mentions = gradeMentions(title);
  const ungradedTitle =
    mentions.length > 0 || /\b(PSA|BGS|CGC|SGC|TAG|ACE|GMA|HGA)\s+graded\b/i.test(title);
  if (!providerCompany && !providerGrade && ungradedTitle) {
    pushFlag(flags, flag("grade_conflict", "Listing title names a grade but the sale is ungraded"));
  } else {
    for (const mention of mentions) {
      if (providerCompany && mention.company !== providerCompany) {
        pushFlag(flags, flag("company_conflict"));
      } else if (providerGrade && mention.grade !== providerGrade) {
        pushFlag(flags, flag("grade_conflict"));
      }
    }
  }

  if (titleIndicatesDamage(title) && normalizeRawCondition(comp.condition) !== "DMG") {
    pushFlag(flags, flag("damaged"));
  }
  if (comp.signed === true || titleIndicatesSigned(title)) {
    pushFlag(flags, flag("signed"));
  }
  if (comp.error === true || titleIndicatesError(title)) {
    pushFlag(flags, flag("error_card"));
  }
  return flags;
}

function quartile(sorted: number[], fraction: number): number {
  if (sorted.length === 0) return 0;
  const index = (sorted.length - 1) * fraction;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const lowerValue = sorted[lower] ?? sorted[0] ?? 0;
  const upperValue = sorted[upper] ?? lowerValue;
  return lowerValue * (1 - (index - lower)) + upperValue * (index - lower);
}

export function extremePriceBounds(prices: number[]): PriceBounds | null {
  if (prices.length < EXTREME_PRICE_MIN_SALES) return null;
  const sorted = [...prices].sort((left, right) => left - right);
  const q1 = quartile(sorted, 0.25);
  const q3 = quartile(sorted, 0.75);
  const iqr = q3 - q1;
  return { lower: q1 - 1.5 * iqr, upper: q3 + 1.5 * iqr };
}

function dispositionOf(flags: CompQualityFlag[]): CompDisposition {
  if (flags.some((item) => item.severity === "exclude")) return "excluded";
  if (flags.some((item) => item.severity === "warning")) return "warning";
  return "included";
}

export function evaluateCompQuality(comps: SoldComp[], identity: CompCardIdentity): EvaluatedSoldComp[] {
  const seenIds = new Set<string>();
  const preliminary: EvaluatedSoldComp[] = [];

  for (const comp of comps) {
    if (!isSoldComp(comp)) continue;
    const flags = contentFlags(comp, identity);
    if (comp.externalId) {
      if (seenIds.has(comp.externalId)) pushFlag(flags, flag("duplicate_listing"));
      else seenIds.add(comp.externalId);
    }
    preliminary.push({ comp, flags, disposition: "included" });
  }

  const pricesByBucket = new Map<string, number[]>();
  for (const item of preliminary) {
    if (item.flags.some((itemFlag) => itemFlag.severity === "exclude")) continue;
    if (typeof item.comp.soldPrice !== "number" || !(item.comp.soldPrice > 0)) continue;
    const key = soldCompBucketKey(item.comp);
    const prices = pricesByBucket.get(key) ?? [];
    prices.push(item.comp.soldPrice);
    pricesByBucket.set(key, prices);
  }

  const boundsByBucket = new Map<string, PriceBounds>();
  for (const [key, prices] of pricesByBucket) {
    const bounds = extremePriceBounds(prices);
    if (bounds) boundsByBucket.set(key, bounds);
  }

  for (const item of preliminary) {
    if (item.flags.some((itemFlag) => itemFlag.severity === "exclude")) continue;
    const bounds = boundsByBucket.get(soldCompBucketKey(item.comp));
    if (!bounds || typeof item.comp.soldPrice !== "number") continue;
    if (item.comp.soldPrice < bounds.lower || item.comp.soldPrice > bounds.upper) {
      pushFlag(item.flags, flag("extreme_price"));
    }
  }

  return preliminary.map((item) => ({
    comp: item.comp,
    flags: item.flags,
    disposition: dispositionOf(item.flags),
  }));
}

export function qualitySummary(evaluated: EvaluatedSoldComp[]): QualitySummary {
  const reasons = new Map<CompFlagCode, { count: number; reason: string }>();
  let included = 0;
  let warned = 0;
  let excluded = 0;

  for (const item of evaluated) {
    if (item.disposition === "included") included += 1;
    else if (item.disposition === "warning") warned += 1;
    else excluded += 1;

    if (item.disposition !== "excluded") continue;
    for (const itemFlag of item.flags) {
      if (itemFlag.severity !== "exclude") continue;
      const current = reasons.get(itemFlag.code);
      if (current) current.count += 1;
      else reasons.set(itemFlag.code, { count: 1, reason: itemFlag.reason });
    }
  }

  return {
    included,
    warned,
    excluded,
    exclusionReasons: [...reasons.entries()]
      .map(([code, value]) => ({ code, count: value.count, reason: value.reason }))
      .sort((left, right) => right.count - left.count || left.code.localeCompare(right.code)),
  };
}
