import { closePool, getPool } from "../config/database.js";
import { getPokemonTcgApiKey } from "../config/env.js";
import { mapPokemonTcgCard } from "../mappers/pokemonCardMapper.js";
import { upsertPokemonCard } from "../repositories/pokemonCardRepository.js";
import { fetchCardsPage } from "../services/pokemonTcgApi.js";
import type { PokemonTcgCard } from "../types/pokemonCard.js";

interface ImportStats {
  received: number;
  inserted: number;
  updated: number;
  failed: number;
}

async function importCard(card: PokemonTcgCard, stats: ImportStats): Promise<void> {
  try {
    const record = mapPokemonTcgCard(card);
    const result = await upsertPokemonCard(record);
    if (result === "inserted") {
      stats.inserted += 1;
    } else {
      stats.updated += 1;
    }
  } catch (error) {
    stats.failed += 1;
    const apiId = typeof card.id === "string" ? card.id : "unknown";
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to import card ${apiId}: ${message}`);
  }
}

async function importCards(): Promise<void> {
  await getPool().query("SELECT 1");

  if (!getPokemonTcgApiKey()) {
    console.warn(
      "POKEMON_TCG_API_KEY is not set. Unauthenticated imports are heavily rate limited."
    );
  }

  const stats: ImportStats = {
    received: 0,
    inserted: 0,
    updated: 0,
    failed: 0,
  };

  let page = 1;

  while (true) {
    console.log(`Fetching page ${page}...`);
    const response = await fetchCardsPage(page);
    const cards = response.data;
    console.log(`Received ${cards.length} cards`);

    stats.received += cards.length;

    for (const card of cards) {
      await importCard(card, stats);
    }

    const imported = stats.inserted + stats.updated;
    if (page === 1) {
      console.log(`Imported ${imported} cards`);
    } else {
      console.log(`Imported ${imported} total cards`);
    }

    if (cards.length === 0) {
      break;
    }

    const pageSize = response.pageSize || cards.length;
    const currentPage = response.page || page;
    if (currentPage * pageSize >= response.totalCount) {
      break;
    }

    page += 1;
  }

  console.log("");
  console.log("Import complete");
  console.log("");
  console.log(`Cards received: ${stats.received}`);
  console.log(`Cards inserted: ${stats.inserted}`);
  console.log(`Cards updated: ${stats.updated}`);
  console.log(`Cards failed: ${stats.failed}`);
}

try {
  await importCards();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("password must be a")) {
    console.error(
      "Import failed: PostgreSQL requires a non-empty DATABASE_PASSWORD in .env."
    );
  } else {
    console.error("Import failed:", message);
  }
  process.exitCode = 1;
} finally {
  await closePool();
  process.exit(process.exitCode ?? 0);
}
