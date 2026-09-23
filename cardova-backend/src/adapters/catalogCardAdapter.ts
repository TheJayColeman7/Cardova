import { canonicalCardId, type Card } from "../domain/card.js";
import type { SamplePrice, SampleSale } from "../domain/market.js";

export interface CatalogGradeSource {
  id?: string;
  label?: string;
  price?: number | null;
}

export interface CatalogSaleSource {
  date?: string;
  title?: string;
  price?: number | null;
  gradeId?: string;
  source?: string;
  url?: string;
}

export interface CatalogCardSource {
  id: string;
  name: string;
  number?: string | null;
  set?: string | null;
  category?: string | null;
  variant?: string | null;
  image?: string | null;
  grades?: CatalogGradeSource[];
  sales?: CatalogSaleSource[];
}

const MANUFACTURERS = ["Upper Deck", "Panini", "Donruss", "Playoff", "Topps", "Fleer"];

const GRADE_COMPANIES: Record<string, string> = {
  psa: "PSA",
  bgs: "BGS",
  cgc: "CGC",
  tag: "TAG",
};

function text(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function finitePrice(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function parseSet(setName: string | null): { year: number | null; manufacturer: string | null } {
  if (!setName) return { year: null, manufacturer: null };

  const yearMatch = /^(\d{4})\b/.exec(setName);
  const year = yearMatch?.[1] ? Number(yearMatch[1]) : null;
  const rest = (yearMatch ? setName.slice(yearMatch[0].length) : setName).trim();
  const manufacturer =
    MANUFACTURERS.find((name) => rest === name || rest.startsWith(`${name} `)) ?? null;

  return { year: Number.isInteger(year) ? year : null, manufacturer };
}

function gameAndSport(category: string | null, setName: string | null): { game: string | null; sport: string | null } {
  if (category === "Football" || category === "Baseball" || category === "Basketball") {
    return { game: null, sport: category };
  }

  if (category === "TCG" && setName && /pokemon/i.test(setName)) {
    return { game: "Pokemon", sport: null };
  }

  return { game: null, sport: null };
}

function mapVariant(variant: string | null): Pick<Card, "rookie" | "variation" | "finish" | "parallel" | "firstEdition"> {
  const empty = {
    rookie: null,
    variation: null,
    finish: null,
    parallel: null,
    firstEdition: null,
  };

  if (!variant) return empty;
  if (variant === "Rookie") return { ...empty, rookie: true };
  if (variant === "Rookie Ticket") return { ...empty, rookie: true, variation: "Rookie Ticket" };
  if (/^holo$/i.test(variant)) return { ...empty, finish: "Holo" };
  return { ...empty, variation: variant };
}

interface ParsedGrade {
  gradingCompany: string | null;
  grade: string | null;
  label: string;
}

function parseGrade(id: string | undefined, label: string | undefined): ParsedGrade | null {
  if (!id) return null;
  if (id === "raw") {
    return { gradingCompany: null, grade: null, label: label || "Ungraded" };
  }

  const match = /^(psa|bgs|cgc|tag)(\d+(?:\.\d+)?)$/i.exec(id);
  const companyKey = match?.[1]?.toLowerCase();
  const grade = match?.[2];
  if (!companyKey || !grade) return null;

  const gradingCompany = GRADE_COMPANIES[companyKey] ?? companyKey.toUpperCase();
  return {
    gradingCompany,
    grade,
    label: label || `${gradingCompany} ${grade}`,
  };
}

export function mapCatalogCardToCard(source: CatalogCardSource): Card {
  const setName = text(source.set);
  const { year, manufacturer } = parseSet(setName);
  const { game, sport } = gameAndSport(text(source.category), setName);
  const variant = mapVariant(text(source.variant));
  const image = text(source.image);

  return {
    id: canonicalCardId("catalog", source.id),
    source: "catalog",
    sourceId: source.id,
    game,
    sport,
    name: source.name,
    year,
    manufacturer,
    setId: null,
    setName,
    series: null,
    subset: null,
    cardNumber: text(source.number),
    parallel: variant.parallel,
    variation: variant.variation,
    rarity: null,
    finish: variant.finish,
    language: null,
    rookie: variant.rookie,
    firstEdition: variant.firstEdition,
    imageSmallUrl: image,
    imageLargeUrl: image,
  };
}

export function mapCatalogSamplePrices(source: CatalogCardSource): SamplePrice[] {
  const prices: SamplePrice[] = [];

  for (const grade of source.grades ?? []) {
    const parsed = parseGrade(grade.id, grade.label);
    if (!parsed) continue;
    prices.push({
      dataType: "sample",
      gradingCompany: parsed.gradingCompany,
      grade: parsed.grade,
      label: parsed.label,
      price: finitePrice(grade.price),
      currency: "USD",
    });
  }

  return prices;
}

export function mapCatalogSampleSales(source: CatalogCardSource): SampleSale[] {
  return (source.sales ?? []).map((sale) => {
    const parsed = parseGrade(sale.gradeId, undefined);
    return {
      dataType: "sample",
      title: text(sale.title) ?? "Sample sale",
      price: finitePrice(sale.price),
      currency: "USD",
      date: text(sale.date),
      gradingCompany: parsed?.gradingCompany ?? null,
      grade: parsed?.grade ?? null,
      label: parsed?.label ?? (text(sale.gradeId) ?? "Sample"),
    };
  });
}
