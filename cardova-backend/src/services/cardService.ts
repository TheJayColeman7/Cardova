import {
  isAlternatePrinting,
  parseCardRef,
  type Card,
} from "../domain/card.js";
import { emptySoldComps, type SamplePrice, type SampleSale, type SoldComp } from "../domain/market.js";
import {
  mapCatalogCardToCard,
  mapCatalogSamplePrices,
  mapCatalogSampleSales,
  type CatalogCardSource,
} from "../adapters/catalogCardAdapter.js";
import { mapPokemonCardToCard, type PokemonCardSource } from "../adapters/pokemonCardAdapter.js";

export class CardCatalogUnavailableError extends Error {
  constructor() {
    super("Card catalog is unavailable");
    this.name = "CardCatalogUnavailableError";
  }
}

export interface PokemonCatalogPort {
  searchByName(name: string): Promise<PokemonCardSource[]>;
  getById(id: string): Promise<PokemonCardSource | null>;
}

export interface CardSearchParams {
  q?: unknown;
  sort?: unknown;
  set?: unknown;
  category?: unknown;
  includeVariants?: boolean;
}

export interface CardListItem {
  card: Card;
  samplePrices: SamplePrice[];
}

export interface CardSearchResult {
  query: string;
  results: CardListItem[];
  sets: string[];
}

export interface CardDetail {
  card: Card;
  samplePrices: SamplePrice[];
  sampleSales: SampleSale[];
  soldComps: SoldComp[];
}

export interface CardService {
  searchCards(params: CardSearchParams): Promise<CardSearchResult>;
  getCard(id: string): Promise<Card | null>;
  getCardDetail(id: string): Promise<CardDetail | null>;
}

function trimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function samplePsa10(prices: SamplePrice[]): number | null {
  const match = prices.find(
    (price) => price.dataType === "sample" && price.gradingCompany === "PSA" && price.grade === "10"
  );
  return match?.price ?? null;
}

function matchesText(card: Card, query: string): boolean {
  if (!query) return true;
  const haystack = [
    card.name,
    card.cardNumber,
    card.setName,
    card.series,
    card.sport,
    card.game,
    card.variation,
    card.finish,
    card.parallel,
    card.rarity,
    card.manufacturer,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function matchesCategory(card: Card, category: string): boolean {
  if (!category) return true;
  if (category === "Sports") {
    return card.sport === "Football" || card.sport === "Baseball" || card.sport === "Basketball";
  }
  if (category === "TCG") return card.game != null && card.sport == null;
  if (category === "Football" || category === "Baseball" || category === "Basketball") {
    return card.sport === category;
  }
  return card.game === category || card.sport === category;
}

function matchesSet(card: Card, setName: string): boolean {
  if (!setName) return true;
  return card.setName === setName;
}

export function buildActiveListingQuery(card: Card): string {
  return [card.name, card.setName, card.cardNumber].filter((part): part is string => Boolean(part && part.trim())).join(" ");
}

export function createCardService(deps: {
  catalog: CatalogCardSource[];
  pokemon: PokemonCatalogPort;
}): CardService {
  const catalogById = new Map(deps.catalog.map((card) => [card.id, card]));

  function toListItem(source: CatalogCardSource): CardListItem {
    return {
      card: mapCatalogCardToCard(source),
      samplePrices: mapCatalogSamplePrices(source),
    };
  }

  function applyFilters(item: CardListItem, query: string, setName: string, category: string, includeVariants: boolean): boolean {
    if (!matchesText(item.card, query)) return false;
    if (!matchesSet(item.card, setName)) return false;
    if (!matchesCategory(item.card, category)) return false;
    if (!includeVariants && isAlternatePrinting(item.card)) return false;
    return true;
  }

  return {
    async searchCards(params) {
      const query = trimmed(params.q);
      const setName = trimmed(params.set);
      const category = trimmed(params.category);
      const sort = trimmed(params.sort);
      const includeVariants = params.includeVariants !== false;

      const catalogItems = deps.catalog
        .map(toListItem)
        .filter((item) => applyFilters(item, query, setName, category, includeVariants));

      let pokemonItems: CardListItem[] = [];
      if (query) {
        try {
          const rows = await deps.pokemon.searchByName(query);
          pokemonItems = rows
            .map((row) => ({
              card: mapPokemonCardToCard(row),
              samplePrices: [],
            }))
            .filter((item) => applyFilters(item, query, setName, category, includeVariants));
        } catch (error) {
          console.error(
            "Pokemon catalog search unavailable:",
            error instanceof Error ? error.message : error
          );
        }
      }

      const merged = new Map<string, CardListItem>();
      for (const item of [...catalogItems, ...pokemonItems]) {
        if (!merged.has(item.card.id)) merged.set(item.card.id, item);
      }

      const results = [...merged.values()];
      results.sort((a, b) => {
        if (sort === "price-high" || sort === "price-low") {
          const priceA = samplePsa10(a.samplePrices);
          const priceB = samplePsa10(b.samplePrices);
          if (priceA == null && priceB == null) return a.card.name.localeCompare(b.card.name);
          if (priceA == null) return 1;
          if (priceB == null) return -1;
          return sort === "price-high" ? priceB - priceA : priceA - priceB;
        }
        return a.card.name.localeCompare(b.card.name) || a.card.id.localeCompare(b.card.id);
      });

      const sets = [...new Set(deps.catalog.map((card) => card.set).filter((set): set is string => Boolean(set)))].sort();

      return { query, results, sets };
    },

    async getCard(id) {
      const ref = parseCardRef(id);

      if (ref.explicit && ref.source === "catalog") {
        const source = catalogById.get(ref.sourceId);
        return source ? mapCatalogCardToCard(source) : null;
      }

      if (ref.explicit && ref.source === "pokemon") {
        const row = await deps.pokemon.getById(ref.sourceId);
        return row ? mapPokemonCardToCard(row) : null;
      }

      const catalogHit = catalogById.get(ref.sourceId);
      if (catalogHit) return mapCatalogCardToCard(catalogHit);

      try {
        const row = await deps.pokemon.getById(ref.sourceId);
        return row ? mapPokemonCardToCard(row) : null;
      } catch (error) {
        console.error(
          "Pokemon catalog lookup unavailable:",
          error instanceof Error ? error.message : error
        );
        return null;
      }
    },

    async getCardDetail(id) {
      const card = await this.getCard(id);
      if (!card) return null;

      const source = card.source === "catalog" ? catalogById.get(card.sourceId) : undefined;
      return {
        card,
        samplePrices: source ? mapCatalogSamplePrices(source) : [],
        sampleSales: source ? mapCatalogSampleSales(source) : [],
        soldComps: emptySoldComps(),
      };
    },
  };
}
