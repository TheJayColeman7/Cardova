export type CardSource = "catalog" | "pokemon";

/**
 * Identity of a physical card printing.
 * Grade and grading company are intentionally absent: a PSA 10 and a raw copy
 * are the same card.
 */
export interface Card {
  id: string;
  source: CardSource;
  sourceId: string;
  game: string | null;
  sport: string | null;
  name: string;
  year: number | null;
  manufacturer: string | null;
  setId: string | null;
  setName: string | null;
  series: string | null;
  subset: string | null;
  cardNumber: string | null;
  parallel: string | null;
  variation: string | null;
  rarity: string | null;
  finish: string | null;
  language: string | null;
  rookie: boolean | null;
  firstEdition: boolean | null;
  imageSmallUrl: string | null;
  imageLargeUrl: string | null;
}

const CARD_SOURCES: readonly CardSource[] = ["catalog", "pokemon"];

export interface ParsedCardRef {
  source: CardSource | null;
  sourceId: string;
  explicit: boolean;
}

export function canonicalCardId(source: CardSource, sourceId: string): string {
  return `${source}:${sourceId}`;
}

export function parseCardRef(raw: string): ParsedCardRef {
  const id = raw.trim();
  const separator = id.indexOf(":");
  if (separator > 0) {
    const source = id.slice(0, separator);
    const sourceId = id.slice(separator + 1);
    if (isCardSource(source) && sourceId.length > 0) {
      return { source, sourceId, explicit: true };
    }
  }

  return { source: null, sourceId: id, explicit: false };
}

export function isCardSource(value: string): value is CardSource {
  return (CARD_SOURCES as readonly string[]).includes(value);
}

export function isAlternatePrinting(card: Card): boolean {
  return Boolean(card.variation || card.finish || card.parallel || card.firstEdition || card.rookie);
}
