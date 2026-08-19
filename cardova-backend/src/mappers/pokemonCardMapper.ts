import type { PokemonCardRecord, PokemonTcgCard } from "../types/pokemonCard.js";

function asOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function parseHp(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePokedexNumber(value: unknown): number | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const first = value[0];
  if (typeof first !== "number" || !Number.isFinite(first)) {
    return null;
  }

  return first;
}

function parseReleaseDate(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().replaceAll("/", "-");
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (!match) {
    return null;
  }

  const year = Number.parseInt(match[1] ?? "", 10);
  const month = Number.parseInt(match[2] ?? "", 10);
  const day = Number.parseInt(match[3] ?? "", 10);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return normalized;
}

export function resolvePokemonName(card: PokemonTcgCard): string | null {
  return asOptionalString(card.name);
}

export function mapPokemonTcgCard(card: PokemonTcgCard): PokemonCardRecord {
  const apiId = asOptionalString(card.id);
  const cardName = asOptionalString(card.name);

  if (!apiId || !cardName) {
    throw new Error("Card is missing required id or name");
  }

  return {
    apiId,
    pokemonName: resolvePokemonName(card),
    pokedexNumber: parsePokedexNumber(card.nationalPokedexNumbers),
    cardName,
    cardNumber: asOptionalString(card.number),
    setId: asOptionalString(card.set?.id),
    setName: asOptionalString(card.set?.name),
    seriesName: asOptionalString(card.set?.series),
    rarity: asOptionalString(card.rarity),
    artist: asOptionalString(card.artist),
    supertype: asOptionalString(card.supertype),
    subtypes: asStringArray(card.subtypes),
    pokemonTypes: asStringArray(card.types),
    hp: parseHp(card.hp),
    imageSmallUrl: asOptionalString(card.images?.small),
    imageLargeUrl: asOptionalString(card.images?.large),
    releaseDate: parseReleaseDate(card.set?.releaseDate),
    rawData: card,
  };
}
