import type { PokemonCardRecord } from "../types/pokemonCard.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function read(record: Record<string, unknown>, snake: string, camel: string): unknown {
  if (record[snake] != null) return record[snake];
  return record[camel];
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function parseHp(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function pokedexNumber(value: unknown): number | null {
  if (!Array.isArray(value) || typeof value[0] !== "number" || !Number.isFinite(value[0])) return null;
  return value[0];
}

function releaseDate(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const normalized = raw.replaceAll("/", "-");
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return normalized;
}

function cardImages(value: unknown): { small: string | null; large: string | null } {
  if (!Array.isArray(value)) return { small: null, large: null };
  const images = value.filter(isRecord);
  const front = images.find((image) => image.type === "front") ?? images[0];
  if (!front) return { small: null, large: null };
  return {
    small: text(front.small),
    large: text(front.large) ?? text(front.medium),
  };
}

export function mapScrydexPokemonCard(payload: unknown): PokemonCardRecord {
  if (!isRecord(payload)) {
    throw new Error("Scrydex card is missing its identity");
  }

  const apiId = text(payload.id);
  const cardName = text(payload.name);
  if (!apiId || !cardName) {
    throw new Error("Scrydex card is missing its identity");
  }

  const expansionValue = read(payload, "expansion", "expansion");
  const expansion = isRecord(expansionValue) ? expansionValue : {};
  const images = cardImages(payload.images);

  return {
    apiId,
    pokemonName: cardName,
    pokedexNumber: pokedexNumber(read(payload, "national_pokedex_numbers", "nationalPokedexNumbers")),
    cardName,
    cardNumber: text(payload.number),
    setId: text(expansion.id),
    setName: text(expansion.name),
    seriesName: text(expansion.series),
    rarity: text(payload.rarity),
    artist: text(payload.artist),
    supertype: text(payload.supertype),
    subtypes: stringList(payload.subtypes),
    pokemonTypes: stringList(payload.types),
    hp: parseHp(payload.hp),
    imageSmallUrl: images.small,
    imageLargeUrl: images.large,
    releaseDate: releaseDate(read(expansion, "release_date", "releaseDate")),
    rawData: payload,
  };
}
