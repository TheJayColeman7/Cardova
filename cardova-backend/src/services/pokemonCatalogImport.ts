import { mapScrydexPokemonCard } from "../mappers/scrydexPokemonCardMapper.js";
import type { ScrydexPokemonCardsPage } from "../providers/scrydex/scrydexPokemonCatalog.js";
import type { UpsertResult } from "../repositories/pokemonCardRepository.js";

export interface PokemonImportStats {
  pages: number;
  received: number;
  inserted: number;
  updated: number;
  failed: number;
}

export function hasMorePokemonPages(page: number, response: ScrydexPokemonCardsPage): boolean {
  if (response.data.length === 0) return false;
  const pageSize = response.pageSize > 0 ? response.pageSize : response.data.length;
  const currentPage = response.page > 0 ? response.page : page;
  if (response.totalCount > 0 && currentPage * pageSize >= response.totalCount) return false;
  return response.data.length >= pageSize;
}

export async function importEnglishPokemonCards(options: {
  fetchPage: (page: number) => Promise<ScrydexPokemonCardsPage>;
  upsert: (record: ReturnType<typeof mapScrydexPokemonCard>) => Promise<UpsertResult>;
  log?: (message: string) => void;
}): Promise<PokemonImportStats> {
  const log = options.log ?? (() => undefined);
  const stats: PokemonImportStats = { pages: 0, received: 0, inserted: 0, updated: 0, failed: 0 };
  let page = 1;

  while (true) {
    log(`Fetching page ${page}...`);
    const response = await options.fetchPage(page);
    stats.pages += 1;
    log(`Received ${response.data.length} cards`);

    for (const card of response.data) {
      stats.received += 1;
      try {
        const record = mapScrydexPokemonCard(card);
        const result = await options.upsert(record);
        if (result === "inserted") stats.inserted += 1;
        else stats.updated += 1;
      } catch (error) {
        stats.failed += 1;
        const apiId = card && typeof card === "object" && "id" in card ? String(card.id) : "unknown";
        const message = error instanceof Error ? error.message : "import failed";
        log(`Failed to import card ${apiId}: ${message}`);
      }
    }

    log(`Imported ${stats.inserted + stats.updated} total cards`);
    if (!hasMorePokemonPages(page, response) || page >= 500) break;
    page += 1;
  }

  return stats;
}
