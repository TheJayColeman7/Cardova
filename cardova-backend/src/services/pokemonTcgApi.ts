/**
 * @deprecated The Pokémon TCG API at api.pokemontcg.io is retired.
 * Catalog import uses the Scrydex English card list instead.
 * This client is not on the active import path.
 */
import { getPokemonTcgApiKey } from "../config/env.js";
import type { PokemonTcgCard, PokemonTcgCardsPage } from "../types/pokemonCard.js";
import { HttpStatusError, parseRetryAfter } from "../utils/httpStatusError.js";
import { withRetry } from "../utils/retry.js";

const API_BASE_URL = "https://api.pokemontcg.io/v2/cards";
export const POKEMON_TCG_PAGE_SIZE = 250;

function isPokemonTcgCard(value: unknown): value is PokemonTcgCard {
  return typeof value === "object" && value !== null && "id" in value;
}

function parseCardsPage(payload: unknown): PokemonTcgCardsPage {
  if (!payload || typeof payload !== "object") {
    throw new Error("Unexpected Pokémon TCG API response shape");
  }

  const body = payload as Record<string, unknown>;
  if (!Array.isArray(body.data)) {
    throw new Error("Unexpected Pokémon TCG API response shape");
  }

  return {
    data: body.data.filter(isPokemonTcgCard),
    page: typeof body.page === "number" ? body.page : 0,
    pageSize: typeof body.pageSize === "number" ? body.pageSize : POKEMON_TCG_PAGE_SIZE,
    count: typeof body.count === "number" ? body.count : body.data.length,
    totalCount: typeof body.totalCount === "number" ? body.totalCount : 0,
  };
}

export async function fetchCardsPage(page: number): Promise<PokemonTcgCardsPage> {
  return withRetry(async () => {
    const url = new URL(API_BASE_URL);
    url.searchParams.set("page", String(page));
    url.searchParams.set("pageSize", String(POKEMON_TCG_PAGE_SIZE));

    const headers = new Headers({
      Accept: "application/json",
      "User-Agent": "cardova-backend/1.0 (Pokemon TCG importer)",
    });
    const apiKey = getPokemonTcgApiKey();
    if (apiKey) {
      headers.set("X-Api-Key", apiKey);
    }

    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new HttpStatusError(
        response.status,
        `Pokémon TCG API request failed with HTTP ${response.status}`,
        parseRetryAfter(response.headers.get("Retry-After"))
      );
    }

    const payload: unknown = await response.json();
    return parseCardsPage(payload);
  });
}
