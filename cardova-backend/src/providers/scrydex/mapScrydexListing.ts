import type { SoldComp } from "../../domain/market.js";

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

function price(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function flag(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  return null;
}

export function soldDate(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const match = /^(\d{4})[/-](\d{2})[/-](\d{2})/.exec(raw);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function mapScrydexListing(payload: unknown, cardId: string): SoldComp | null {
  if (!isRecord(payload) || !text(payload.id)) return null;
  return {
    dataType: "sold_comp",
    marketplace: text(payload.source),
    externalId: text(payload.id),
    cardId,
    title: text(payload.title),
    soldPrice: price(payload.price),
    shipping: null,
    currency: text(payload.currency),
    gradingCompany: text(payload.company),
    grade: text(payload.grade) ?? (typeof payload.grade === "number" ? String(payload.grade) : null),
    soldAt: soldDate(read(payload, "sold_at", "soldAt")),
    source: "scrydex",
    variant: text(payload.variant),
    condition: text(payload.condition),
    perfect: flag(read(payload, "is_perfect", "isPerfect")),
    signed: flag(read(payload, "is_signed", "isSigned")),
    error: flag(read(payload, "is_error", "isError")),
    url: text(payload.url),
  };
}
