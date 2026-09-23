import { canonicalCardId, type Card } from "../domain/card.js";

export interface PokemonCardSource {
  apiId: string;
  cardName: string;
  cardNumber: string | null;
  setId: string | null;
  setName: string | null;
  seriesName: string | null;
  rarity: string | null;
  imageSmallUrl: string | null;
  imageLargeUrl: string | null;
  releaseDate: string | null;
}

function text(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function yearFromRelease(releaseDate: string | null): number | null {
  if (!releaseDate) return null;
  const match = /^(\d{4})/.exec(releaseDate);
  if (!match?.[1]) return null;
  const year = Number(match[1]);
  return Number.isInteger(year) ? year : null;
}

export function mapPokemonCardToCard(source: PokemonCardSource): Card {
  return {
    id: canonicalCardId("pokemon", source.apiId),
    source: "pokemon",
    sourceId: source.apiId,
    game: "Pokemon",
    sport: null,
    name: source.cardName,
    year: yearFromRelease(text(source.releaseDate)),
    manufacturer: null,
    setId: text(source.setId),
    setName: text(source.setName),
    series: text(source.seriesName),
    subset: null,
    cardNumber: text(source.cardNumber),
    parallel: null,
    variation: null,
    rarity: text(source.rarity),
    finish: null,
    language: null,
    rookie: null,
    firstEdition: null,
    imageSmallUrl: text(source.imageSmallUrl),
    imageLargeUrl: text(source.imageLargeUrl),
  };
}
