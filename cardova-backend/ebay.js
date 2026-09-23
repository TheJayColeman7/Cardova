import axios from "axios";
import { mapEbayItemSummary } from "./src/adapters/ebayListingAdapter.ts";

const LISTING_CACHE_MS = 5 * 60 * 1000;
const listingCache = new Map();

let tokenCache = { accessToken: null, expiresAt: 0 };

function envValue(name) {
  return (process.env[name] || "").trim();
}

function ebayCredentials() {
  const production = {
    clientId: envValue("EBAY_PRODUCTION_CLIENT_ID"),
    clientSecret: envValue("EBAY_PRODUCTION_CLIENT_SECRET"),
    env: envValue("EBAY_PRODUCTION_ENV").toLowerCase() || "production",
  };
  const sandbox = {
    clientId: envValue("EBAY_SANDBOX_CLIENT_ID"),
    clientSecret: envValue("EBAY_SANDBOX_CLIENT_SECRET"),
    env: envValue("EBAY_SANDBOX_ENV").toLowerCase() || "sandbox",
  };

  if (production.clientId && production.clientSecret) return production;
  return sandbox;
}

function isSandbox() {
  const { clientId, env } = ebayCredentials();
  if (env === "production" || clientId.includes("-PRD-")) return false;
  return env === "sandbox" || clientId.includes("-SBX-") || Boolean(clientId);
}

function apiHost() {
  return isSandbox() ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
}

export function isEbayConfigured() {
  const { clientId, clientSecret } = ebayCredentials();
  return Boolean(clientId && clientSecret);
}

async function getAccessToken() {
  const now = Date.now();
  if (tokenCache.accessToken && now < tokenCache.expiresAt - 60_000) {
    return tokenCache.accessToken;
  }

  const { clientId, clientSecret } = ebayCredentials();
  if (!clientId || !clientSecret) {
    throw new Error("eBay is not configured");
  }
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await axios.post(
    `${apiHost()}/identity/v1/oauth2/token`,
    new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope",
    }).toString(),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basic}`,
      },
    }
  );

  const expiresIn = Number(response.data.expires_in || 7200);
  tokenCache = {
    accessToken: response.data.access_token,
    expiresAt: now + expiresIn * 1000,
  };
  return tokenCache.accessToken;
}

function mapListing(item) {
  return mapEbayItemSummary(item, new Date().toISOString());
}

function publicEbayError(err, stage) {
  const status = err.response?.status ?? null;
  const data = err.response?.data;
  const first = Array.isArray(data?.errors) ? data.errors[0] : null;
  const message = String(
    first?.longMessage ||
      first?.message ||
      data?.error_description ||
      data?.error ||
      err.message ||
      "eBay error"
  ).slice(0, 300);

  console.error("eBay listings fetch failed", status || err.message, stage, message);

  return {
    listings: [],
    reason: "ebay-error",
    status,
    stage,
    message,
    errorId: first?.errorId || data?.error || null,
  };
}

export async function searchListings(query) {
  if (!isEbayConfigured()) {
    return { listings: [], reason: "not-configured" };
  }

  const q = String(query || "").trim();
  if (!q) {
    return { listings: [], reason: "empty-query" };
  }

  const cached = listingCache.get(q);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.value;
  }

  let token;
  try {
    token = await getAccessToken();
  } catch (err) {
    return publicEbayError(err, "token");
  }

  try {
    const response = await axios.get(`${apiHost()}/buy/browse/v1/item_summary/search`, {
      params: {
        q,
        limit: 8,
      },
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
      },
    });

    const items = Array.isArray(response.data.itemSummaries) ? response.data.itemSummaries : [];
    const listings = items.map(mapListing).filter((item) => item);
    const value = { listings, live: true };
    listingCache.set(q, { value, expiresAt: Date.now() + LISTING_CACHE_MS });
    return value;
  } catch (err) {
    return publicEbayError(err, "browse");
  }
}
