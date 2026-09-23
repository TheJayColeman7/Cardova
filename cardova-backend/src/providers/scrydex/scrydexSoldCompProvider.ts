import { getScrydexCredentials } from "../../config/env.js";
import type { SoldComp } from "../../domain/market.js";
import { MARKET_WINDOW_DAYS } from "../../domain/marketSummary.js";
import { HttpStatusError, parseRetryAfter } from "../../utils/httpStatusError.js";
import { withRetry } from "../../utils/retry.js";
import { mapScrydexListing } from "./mapScrydexListing.js";

export const SOLD_COMP_PAGE_SIZE = 100;
export const MAX_SOLD_COMP_PAGES = 5;

const LISTINGS_URL = "https://api.scrydex.com/pokemon/v1/cards";

export class MarketDataError extends Error {
  readonly code: "provider_unavailable" | "market_timeout" | "provider_response";

  constructor(code: MarketDataError["code"], message: string) {
    super(message);
    this.name = "MarketDataError";
    this.code = code;
  }
}

export interface SoldCompQuery {
  cardId: string;
  providerCardId: string;
  windowDays?: number;
}

export interface SoldCompFetchResult {
  comps: SoldComp[];
  windowComplete: boolean;
  pagesFetched: number;
}

type Credentials = { apiKey: string; teamId: string };

export function scrydexListingsUrl(providerCardId: string, page: number, windowDays: number): URL {
  const url = new URL(`${LISTINGS_URL}/${encodeURIComponent(providerCardId)}/listings`);
  url.searchParams.set("days", String(windowDays));
  url.searchParams.set("page", String(page));
  url.searchParams.set("page_size", String(SOLD_COMP_PAGE_SIZE));
  url.searchParams.set("casing", "snake");
  return url;
}

function numberField(body: Record<string, unknown>, snake: string, camel: string): number | null {
  const value = body[snake] ?? body[camel];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toMarketError(error: unknown): MarketDataError {
  if (error instanceof MarketDataError) return error;
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return new MarketDataError("market_timeout", "Sold comps timed out.");
  }
  if (error instanceof HttpStatusError && (error.status === 408 || error.status === 504)) {
    return new MarketDataError("market_timeout", "Sold comps timed out.");
  }
  return new MarketDataError("provider_unavailable", "Sold comps are unavailable.");
}

export async function fetchScrydexSoldComps(
  query: SoldCompQuery,
  options?: {
    fetchImpl?: typeof fetch;
    getCredentials?: () => Credentials | null;
  }
): Promise<SoldCompFetchResult> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const credentials = (options?.getCredentials ?? getScrydexCredentials)();
  if (!credentials) {
    throw new MarketDataError("provider_unavailable", "Sold comps are unavailable.");
  }

  const windowDays = query.windowDays ?? MARKET_WINDOW_DAYS;
  const comps: SoldComp[] = [];
  let windowComplete = true;
  let pagesFetched = 0;

  for (let page = 1; page <= MAX_SOLD_COMP_PAGES; page += 1) {
    const url = scrydexListingsUrl(query.providerCardId, page, windowDays);
    let payload: unknown;
    try {
      payload = await withRetry(async () => {
        let response: Response;
        try {
          response = await fetchImpl(url, {
            headers: {
              Accept: "application/json",
              "X-Api-Key": credentials.apiKey,
              "X-Team-ID": credentials.teamId,
            },
            signal: AbortSignal.timeout(30_000),
          });
        } catch (error) {
          throw error;
        }
        if (!response.ok) {
          throw new HttpStatusError(
            response.status,
            "Sold comps are unavailable.",
            parseRetryAfter(response.headers.get("Retry-After"))
          );
        }
        try {
          return await response.json();
        } catch {
          throw new MarketDataError("provider_response", "Sold comps returned an unexpected response.");
        }
      });
    } catch (error) {
      throw toMarketError(error);
    }

    if (!payload || typeof payload !== "object" || !("data" in payload) || !Array.isArray(payload.data)) {
      throw new MarketDataError("provider_response", "Sold comps returned an unexpected response.");
    }
    pagesFetched += 1;
    const body = payload as Record<string, unknown>;
    const pageSize = numberField(body, "page_size", "pageSize") ?? payload.data.length;
    const totalCount = numberField(body, "total_count", "totalCount");
    for (const item of payload.data) {
      const comp = mapScrydexListing(item, query.cardId);
      if (comp) comps.push(comp);
    }
    const reachedEnd = payload.data.length === 0 || payload.data.length < (pageSize || SOLD_COMP_PAGE_SIZE);
    const reachedTotal = totalCount != null && page * (pageSize || SOLD_COMP_PAGE_SIZE) >= totalCount;
    if (reachedEnd || reachedTotal) {
      windowComplete = true;
      break;
    }
    if (page === MAX_SOLD_COMP_PAGES) windowComplete = false;
  }

  return { comps, windowComplete, pagesFetched };
}
