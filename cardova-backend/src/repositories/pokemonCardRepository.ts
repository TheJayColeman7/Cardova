import { getPool } from "../config/database.js";
import type {
  PokemonCardDetail,
  PokemonCardListItem,
  PokemonCardListQuery,
  PokemonCardListResult,
  PokemonCardRecord,
  PokemonCardRow,
} from "../types/pokemonCard.js";

const LIST_COLUMNS = `
  id, api_id, pokemon_name, pokedex_number, card_name, card_number,
  set_id, set_name, series_name, rarity, artist, supertype, subtypes,
  pokemon_types, hp, image_small_url, image_large_url, release_date,
  created_at, updated_at
`;

function toIsoString(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

function toListItem(row: Omit<PokemonCardRow, "raw_data">): PokemonCardListItem {
  return {
    id: row.id,
    apiId: row.api_id,
    pokemonName: row.pokemon_name,
    pokedexNumber: row.pokedex_number,
    cardName: row.card_name,
    cardNumber: row.card_number,
    setId: row.set_id,
    setName: row.set_name,
    seriesName: row.series_name,
    rarity: row.rarity,
    artist: row.artist,
    supertype: row.supertype,
    subtypes: row.subtypes ?? [],
    pokemonTypes: row.pokemon_types ?? [],
    hp: row.hp,
    imageSmallUrl: row.image_small_url,
    imageLargeUrl: row.image_large_url,
    releaseDate: row.release_date,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

export type UpsertResult = "inserted" | "updated";

export async function upsertPokemonCard(record: PokemonCardRecord): Promise<UpsertResult> {
  const pool = getPool();
  const result = await pool.query<{ inserted: boolean }>(
    `
      INSERT INTO pokemon_cards (
        api_id,
        pokemon_name,
        pokedex_number,
        card_name,
        card_number,
        set_id,
        set_name,
        series_name,
        rarity,
        artist,
        supertype,
        subtypes,
        pokemon_types,
        hp,
        image_small_url,
        image_large_url,
        release_date,
        raw_data,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, NOW()
      )
      ON CONFLICT (api_id) DO UPDATE SET
        pokemon_name = EXCLUDED.pokemon_name,
        pokedex_number = EXCLUDED.pokedex_number,
        card_name = EXCLUDED.card_name,
        card_number = EXCLUDED.card_number,
        set_id = EXCLUDED.set_id,
        set_name = EXCLUDED.set_name,
        series_name = EXCLUDED.series_name,
        rarity = EXCLUDED.rarity,
        artist = EXCLUDED.artist,
        supertype = EXCLUDED.supertype,
        subtypes = EXCLUDED.subtypes,
        pokemon_types = EXCLUDED.pokemon_types,
        hp = EXCLUDED.hp,
        image_small_url = EXCLUDED.image_small_url,
        image_large_url = EXCLUDED.image_large_url,
        release_date = EXCLUDED.release_date,
        raw_data = EXCLUDED.raw_data,
        updated_at = NOW()
      RETURNING (xmax = 0) AS inserted
    `,
    [
      record.apiId,
      record.pokemonName,
      record.pokedexNumber,
      record.cardName,
      record.cardNumber,
      record.setId,
      record.setName,
      record.seriesName,
      record.rarity,
      record.artist,
      record.supertype,
      record.subtypes,
      record.pokemonTypes,
      record.hp,
      record.imageSmallUrl,
      record.imageLargeUrl,
      record.releaseDate,
      JSON.stringify(record.rawData),
    ]
  );

  return result.rows[0]?.inserted ? "inserted" : "updated";
}

function escapeIlike(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

export async function listPokemonCards(
  query: PokemonCardListQuery
): Promise<PokemonCardListResult> {
  const pool = getPool();
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (query.name) {
    values.push(`%${escapeIlike(query.name)}%`);
    conditions.push(
      `(card_name ILIKE $${values.length} ESCAPE '\\' OR pokemon_name ILIKE $${values.length} ESCAPE '\\')`
    );
  }

  if (query.pokedexNumber != null) {
    values.push(query.pokedexNumber);
    conditions.push(`pokedex_number = $${values.length}`);
  }

  if (query.set) {
    values.push(query.set);
    values.push(`%${escapeIlike(query.set)}%`);
    conditions.push(
      `(set_id = $${values.length - 1} OR set_name ILIKE $${values.length} ESCAPE '\\')`
    );
  }

  if (query.rarity) {
    values.push(query.rarity);
    conditions.push(`rarity ILIKE $${values.length} ESCAPE '\\'`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const countResult = await pool.query<{ total: number }>(
    `SELECT COUNT(*)::int AS total FROM pokemon_cards ${whereClause}`,
    values
  );

  const offset = (query.page - 1) * query.pageSize;
  values.push(query.pageSize);
  values.push(offset);

  const result = await pool.query<Omit<PokemonCardRow, "raw_data">>(
    `
      SELECT ${LIST_COLUMNS}
      FROM pokemon_cards
      ${whereClause}
      ORDER BY card_name ASC, api_id ASC
      LIMIT $${values.length - 1}
      OFFSET $${values.length}
    `,
    values
  );

  return {
    page: query.page,
    pageSize: query.pageSize,
    total: countResult.rows[0]?.total ?? 0,
    results: result.rows.map(toListItem),
  };
}

export async function getPokemonCardById(id: string): Promise<PokemonCardDetail | null> {
  const pool = getPool();
  const numericId = /^\d+$/.test(id) ? Number.parseInt(id, 10) : null;

  const result = await pool.query<PokemonCardRow>(
    `
      SELECT ${LIST_COLUMNS}, raw_data
      FROM pokemon_cards
      WHERE api_id = $1
         OR ($2::bigint IS NOT NULL AND id = $2)
      ORDER BY CASE WHEN api_id = $1 THEN 0 ELSE 1 END
      LIMIT 1
    `,
    [id, numericId]
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    ...toListItem(row),
    rawData: row.raw_data,
  };
}
