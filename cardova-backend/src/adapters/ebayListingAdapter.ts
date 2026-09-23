import type { MarketplaceListing } from "../domain/market.js";

export interface EbayItemSummaryInput {
  itemId?: string;
  title?: string;
  price?: { value?: string | number; currency?: string };
  currentBidPrice?: { value?: string | number; currency?: string };
  image?: { imageUrl?: string };
  thumbnailImages?: Array<{ imageUrl?: string }>;
  itemWebUrl?: string;
  itemHref?: string;
  condition?: string;
  seller?: { username?: string };
  buyingOptions?: string[];
  shippingOptions?: Array<{ shippingCost?: { value?: string | number; currency?: string } }>;
}

const LISTING_TYPES: Record<string, string> = {
  FIXED_PRICE: "fixed_price",
  AUCTION: "auction",
  BEST_OFFER: "best_offer",
};

function amount(value: string | number | undefined): number | null {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value: string | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function mapListingType(buyingOptions: string[] | undefined): string | null {
  if (!buyingOptions || buyingOptions.length === 0) return null;

  const mapped = buyingOptions
    .map((option) => LISTING_TYPES[option])
    .filter((option): option is string => Boolean(option));

  if (mapped.includes("fixed_price")) return "fixed_price";
  if (mapped.includes("auction")) return "auction";
  return mapped[0] ?? null;
}

function shippingAmount(item: EbayItemSummaryInput): number | null {
  const options = item.shippingOptions;
  if (!options || options.length === 0) return null;

  for (const option of options) {
    const cost = amount(option.shippingCost?.value);
    if (cost != null) return cost;
  }

  return null;
}

export function mapEbayItemSummary(
  item: EbayItemSummaryInput,
  observedAt: string
): MarketplaceListing | null {
  const url = text(item.itemWebUrl) ?? text(item.itemHref);
  if (!url) return null;

  const price = amount(item.price?.value) ?? amount(item.currentBidPrice?.value);
  const shipping = shippingAmount(item);
  const currency = text(item.price?.currency) ?? text(item.currentBidPrice?.currency) ?? "USD";

  return {
    dataType: "active_listing",
    marketplace: "ebay",
    listingId: text(item.itemId),
    title: text(item.title) ?? "eBay listing",
    price,
    shipping,
    totalPrice: price != null && shipping != null ? Number((price + shipping).toFixed(2)) : null,
    currency,
    condition: text(item.condition),
    gradingCompany: null,
    grade: null,
    seller: text(item.seller?.username),
    imageUrl: text(item.image?.imageUrl) ?? text(item.thumbnailImages?.[0]?.imageUrl),
    url,
    listingType: mapListingType(item.buyingOptions),
    observedAt,
  };
}
