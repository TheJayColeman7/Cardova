import { getScrydexCredentials } from "../../config/env.js";
import { HttpStatusError, parseRetryAfter } from "../../utils/httpStatusError.js";
import { withRetry } from "../../utils/retry.js";

export const SCRYDEX_POKEMON_PAGE_SIZE = 100;
const CARDS_URL = "https://api.scrydex.com/pokemon/v1/en/cards";
const SELECT_FIELDS = [
  "id",
  "name",
  "supertype",
  "subtypes",
  "types",
  "hp",
  "number",
  "rarity",
  "artist",
  "national_pokedex_numbers",
  "images",
  "expansion",
  "language",
  "language_code",
].join(",");

export interface ScrydexPokemonCardsPage {
  data: unknown[];
  page: number;
  pageSize: number;
  count: number;
  totalCount: number;
}

type Credentials = { apiKey: string; teamId: string };

export function scrydexEnglishPokemonCardsUrl(page: number): URL {
  const url = new URL(CARDS_URL);
  url.searchParams.set("page", String(page));
  url.searchParams.set("page_size", String(SCRYDEX_POKEMON_PAGE_SIZE));
  url.searchParams.set("casing", "snake");
  url.searchParams.set("select", SELECT_FIELDS);
  return url;
}

function numberField(body: Record<string, unknown>, snake: string, camel: string): number | null {
  const value = body[snake] ?? body[camel];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function parseScrydexPokemonCardsPage(payload: unknown): ScrydexPokemonCardsPage {
  if (!payload || typeof payload !== "object" || !("data" in payload) || !Array.isArray(payload.data)) {
    throw new Error("Scrydex returned an unexpected card list.");
  }

  const body = payload as Record<string, unknown>;
  return {
    data: payload.data,
    page: numberField(body, "page", "page") ?? 0,
    pageSize: numberField(body, "page_size", "pageSize") ?? payload.data.length,
    count: numberField(body, "count", "count") ?? payload.data.length,
    totalCount: numberField(body, "total_count", "totalCount") ?? 0,
  };
}

export async function fetchScrydexPokemonCardsPage(
  page: number,
  options?: {
    fetchImpl?: typeof fetch;
    getCredentials?: () => Credentials | null;
  }
): Promise<ScrydexPokemonCardsPage> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const getCredentials = options?.getCredentials ?? getScrydexCredentials;
  const credentials = getCredentials();
  if (!credentials) {
    throw new Error("Card catalog import requires SCRYDEX_API_KEY and SCRYDEX_TEAM_ID.");
  }

  const url = scrydexEnglishPokemonCardsUrl(page);
  return withRetry(async () => {
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
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
        throw error;
      }
      throw error;
    }

    if (!response.ok) {
      throw new HttpStatusError(
        response.status,
        `Scrydex card list failed with HTTP ${response.status}`,
        parseRetryAfter(response.headers.get("Retry-After"))
      );
    }

    try {
      return parseScrydexPokemonCardsPage(await response.json());
    } catch {
      throw new Error("Scrydex returned an unexpected card list.");
    }
  });
}
