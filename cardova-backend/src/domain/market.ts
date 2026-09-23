export interface SamplePrice {
  dataType: "sample";
  gradingCompany: string | null;
  grade: string | null;
  label: string;
  price: number | null;
  currency: string;
}

export interface SampleSale {
  dataType: "sample";
  title: string;
  price: number | null;
  currency: string;
  date: string | null;
  gradingCompany: string | null;
  grade: string | null;
  label: string;
}

export interface PriceGuideValue {
  dataType: "price_guide";
  marketplace: string | null;
  gradingCompany: string | null;
  grade: string | null;
  label: string;
  price: number | null;
  currency: string;
  observedAt: string | null;
}

export interface MarketplaceListing {
  dataType: "active_listing";
  marketplace: string;
  listingId: string | null;
  title: string;
  price: number | null;
  shipping: number | null;
  totalPrice: number | null;
  currency: string;
  condition: string | null;
  gradingCompany: string | null;
  grade: string | null;
  seller: string | null;
  imageUrl: string | null;
  url: string;
  listingType: string | null;
  observedAt: string;
}

export interface SoldComp {
  dataType: "sold_comp";
  marketplace: string;
  externalId: string | null;
  cardId: string;
  title: string | null;
  soldPrice: number | null;
  shipping: number | null;
  currency: string;
  gradingCompany: string | null;
  grade: string | null;
  soldAt: string | null;
  source: string;
}

export type MarketRecord = SamplePrice | SampleSale | PriceGuideValue | MarketplaceListing | SoldComp;

export function isSoldComp(value: { dataType?: string } | null | undefined): value is SoldComp {
  return value?.dataType === "sold_comp";
}

export function isActiveListing(
  value: { dataType?: string } | null | undefined
): value is MarketplaceListing {
  return value?.dataType === "active_listing";
}

export function isSampleMarketRecord(value: { dataType?: string } | null | undefined): boolean {
  return value?.dataType === "sample";
}

export interface EbayListingFetchResult {
  listings?: MarketplaceListing[];
  live?: boolean;
  reason?: string;
  status?: number | null;
  stage?: string;
  message?: string;
  errorId?: string | number | null;
}

export interface ActiveListingsResponse {
  listings: MarketplaceListing[];
  soldComps: SoldComp[];
  live?: boolean;
  reason?: string;
  status?: number | null;
  stage?: string;
  message?: string;
  errorId?: string | number | null;
}

export function activeListingsResponse(result: EbayListingFetchResult): ActiveListingsResponse {
  const response: ActiveListingsResponse = {
    listings: Array.isArray(result.listings) ? result.listings : [],
    soldComps: [],
  };

  if (result.live !== undefined) response.live = result.live;
  if (result.reason !== undefined) response.reason = result.reason;
  if (result.status !== undefined) response.status = result.status;
  if (result.stage !== undefined) response.stage = result.stage;
  if (result.message !== undefined) response.message = result.message;
  if (result.errorId !== undefined) response.errorId = result.errorId;

  return response;
}

export function emptySoldComps(): SoldComp[] {
  return [];
}
