import type { Card } from "../domain/card.js";
import {
  evaluateCompQuality,
  qualitySummary,
  type CompCardIdentity,
  type CompQualityFlag,
  type QualitySummary,
} from "../domain/compQuality.js";
import type { SoldComp } from "../domain/market.js";
import {
  MARKET_WINDOW_DAYS,
  distinctVariants,
  summarizeSoldComps,
  usdSoldComps,
  type GradeMarketSummaries,
  type MarketExclusions,
} from "../domain/marketSummary.js";
import {
  fetchScrydexSoldComps,
  MarketDataError,
  type SoldCompFetchResult,
} from "../providers/scrydex/scrydexSoldCompProvider.js";

export const MARKET_CACHE_TTL_MS = 30 * 60 * 1000;

export interface MarketSoldComp extends SoldComp {
  quality: {
    disposition: "included" | "warning" | "excluded";
    flags: CompQualityFlag[];
  };
}

export interface MarketResponse {
  cardId: string;
  windowDays: number;
  windowComplete: boolean;
  available: boolean;
  variant: string | null;
  variants: string[];
  selectionRequired: boolean;
  summaries: GradeMarketSummaries | null;
  soldComps: MarketSoldComp[];
  exclusions: MarketExclusions;
  quality: QualitySummary;
  cached: boolean;
}

const emptyQuality = (): QualitySummary => ({
  included: 0,
  warned: 0,
  excluded: 0,
  exclusionReasons: [],
});

function identityFor(card: Card, variant: string | null): CompCardIdentity {
  const language = card.language?.trim() || (card.source === "pokemon" ? "English" : null);
  return {
    name: card.name,
    setName: card.setName,
    cardNumber: card.cardNumber,
    language,
    variant,
  };
}

interface CacheEntry {
  expiresAt: number;
  value: SoldCompFetchResult & { exclusions: MarketExclusions; included: SoldComp[]; otherCurrency: SoldComp[] };
}

const emptyExclusions = (): MarketExclusions => ({
  missingPrice: 0,
  nonPositivePrice: 0,
  nonUsd: 0,
  outsideWindow: 0,
  missingDate: 0,
  notSoldComp: 0,
});

function cacheKey(cardId: string): string {
  return `${cardId}|${MARKET_WINDOW_DAYS}`;
}

export const UNSPECIFIED_VARIANT = "__unspecified__";

function matchesVariant(comp: SoldComp, selected: string | null): boolean {
  if (selected == null) return true;
  if (selected === UNSPECIFIED_VARIANT) return comp.variant == null;
  return comp.variant === selected;
}

export function createMarketService(options?: {
  fetchSoldComps?: typeof fetchScrydexSoldComps;
  now?: () => number;
  ttlMs?: number;
}) {
  const fetchSoldComps = options?.fetchSoldComps ?? fetchScrydexSoldComps;
  const now = options?.now ?? Date.now;
  const ttlMs = options?.ttlMs ?? MARKET_CACHE_TTL_MS;
  const cache = new Map<string, CacheEntry>();

  function present(card: Card, entry: CacheEntry, variant: string | null, cached: boolean): MarketResponse {
    const names = distinctVariants(entry.value.included);
    const hasUnspecified = entry.value.included.some((comp) => !comp.variant);
    const variants = hasUnspecified && names.length > 0 ? [...names, UNSPECIFIED_VARIANT] : names;
    const selectionRequired = variant == null && variants.length > 1;
    const selected = selectionRequired ? null : variant ?? (variants.length === 1 ? variants[0] ?? null : null);
    const scoped = selectionRequired ? [] : entry.value.included.filter((comp) => matchesVariant(comp, selected));
    const other = selectionRequired ? [] : entry.value.otherCurrency.filter((comp) => matchesVariant(comp, selected));
    const identity = identityFor(card, selected);
    const evaluated = selectionRequired ? [] : evaluateCompQuality(scoped, identity);
    const qualityByComp = new Map(evaluated.map((item) => [item.comp, item]));
    const soldComps = [...scoped, ...other]
      .sort((left, right) => (right.soldAt ?? "").localeCompare(left.soldAt ?? ""))
      .map((comp) => {
        const found = qualityByComp.get(comp);
        return {
          ...comp,
          quality: found
            ? { disposition: found.disposition, flags: found.flags }
            : { disposition: "excluded" as const, flags: [] },
        };
      });
    return {
      cardId: card.id,
      windowDays: MARKET_WINDOW_DAYS,
      windowComplete: entry.value.windowComplete,
      available: true,
      variant: selected,
      variants,
      selectionRequired,
      summaries: selectionRequired
        ? null
        : summarizeSoldComps(scoped, {
            identity,
            windowComplete: entry.value.windowComplete,
            now: new Date(now()),
          }),
      soldComps,
      exclusions: entry.value.exclusions,
      quality: selectionRequired ? emptyQuality() : qualitySummary(evaluated),
      cached,
    };
  }

  return {
    async getMarket(card: Card, variant: string | null): Promise<MarketResponse> {
      if (card.source !== "pokemon" || !card.sourceId) {
        return {
          cardId: card.id,
          windowDays: MARKET_WINDOW_DAYS,
          windowComplete: true,
          available: false,
          variant: null,
          variants: [],
          selectionRequired: false,
          summaries: null,
          soldComps: [],
          exclusions: emptyExclusions(),
          quality: emptyQuality(),
          cached: false,
        };
      }

      const key = cacheKey(card.id);
      const hit = cache.get(key);
      if (hit && hit.expiresAt > now()) {
        console.info("market cache hit", { cardId: card.id, windowDays: MARKET_WINDOW_DAYS });
        return present(card, hit, variant, true);
      }

      const started = now();
      console.info("market request started", { cardId: card.id, windowDays: MARKET_WINDOW_DAYS });
      let fetched: SoldCompFetchResult;
      try {
        fetched = await fetchSoldComps({ cardId: card.id, providerCardId: card.sourceId });
      } catch (error) {
        if (error instanceof MarketDataError) throw error;
        throw new MarketDataError("provider_unavailable", "Sold comps are unavailable.");
      }
      const classified = usdSoldComps(fetched.comps, new Date(now()));
      const entry: CacheEntry = {
        expiresAt: now() + ttlMs,
        value: { ...fetched, ...classified },
      };
      cache.set(key, entry);
      console.info("market provider finished", {
        cardId: card.id,
        latencyMs: now() - started,
        pagesFetched: fetched.pagesFetched,
        compCount: classified.included.length,
        windowComplete: fetched.windowComplete,
      });
      return present(card, entry, variant, false);
    },
  };
}
