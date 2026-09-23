import { closePool, getPool } from "../config/database.js";
import { fetchScrydexPokemonCardsPage } from "../providers/scrydex/scrydexPokemonCatalog.js";
import { upsertPokemonCard } from "../repositories/pokemonCardRepository.js";
import { importEnglishPokemonCards } from "../services/pokemonCatalogImport.js";

async function importCards(): Promise<void> {
  await getPool().query("SELECT 1");
  const started = Date.now();
  const stats = await importEnglishPokemonCards({
    fetchPage: (page) => fetchScrydexPokemonCardsPage(page),
    upsert: upsertPokemonCard,
    log: (message) => console.log(message),
  });
  const counted = await getPool().query<{ count: number }>("SELECT COUNT(*)::int AS count FROM pokemon_cards");
  const seconds = Math.round((Date.now() - started) / 1000);

  console.log("");
  console.log("Import complete");
  console.log(`Pages fetched: ${stats.pages}`);
  console.log(`Cards received: ${stats.received}`);
  console.log(`Cards inserted: ${stats.inserted}`);
  console.log(`Cards updated: ${stats.updated}`);
  console.log(`Cards failed: ${stats.failed}`);
  console.log(`pokemon_cards rows: ${counted.rows[0]?.count ?? 0}`);
  console.log(`Duration seconds: ${seconds}`);
}

try {
  await importCards();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("password must be a")) {
    console.error("Import failed: PostgreSQL requires a non-empty DATABASE_PASSWORD in .env.");
  } else {
    console.error("Import failed:", message);
  }
  process.exitCode = 1;
} finally {
  await closePool();
  process.exit(process.exitCode ?? 0);
}
