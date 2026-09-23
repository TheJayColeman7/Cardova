import { useEffect, useState } from "react";
import { cardApiUrl } from "../lib/cards";
import { formatListingPrice } from "../lib/format";

function ListingCard({ listing }) {
  const [broken, setBroken] = useState(false);

  return (
    <a
      href={listing.url}
      target="_blank"
      rel="noreferrer"
      className="min-w-[148px] max-w-[148px] shrink-0 rounded-2xl border border-charcoal-200 overflow-hidden bg-white hover:border-navy"
    >
      <div className="h-28 bg-charcoal-50 flex items-center justify-center overflow-hidden">
        {listing.imageUrl && !broken ? (
          <img
            src={listing.imageUrl}
            alt=""
            className="h-full w-full object-contain"
            onError={() => setBroken(true)}
          />
        ) : (
          <span className="text-xs font-semibold text-charcoal-400">eBay</span>
        )}
      </div>
      <div className="px-3 py-2">
        <p className="text-xs text-charcoal line-clamp-2 min-h-8">{listing.title}</p>
        <p className="mt-1 text-lg font-extrabold text-navy">
          {formatListingPrice(listing.price, listing.currency)}
        </p>
        {listing.shipping != null && (
          <p className="text-xs text-charcoal-400">
            + {formatListingPrice(listing.shipping, listing.currency)} shipping
          </p>
        )}
        <p className="mt-1 text-sm font-bold text-baby-blue-600">View on eBay</p>
      </div>
    </a>
  );
}

export default function EbayListings({ cardId }) {
  const [listings, setListings] = useState([]);
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!cardId) return undefined;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setReason("");
      setDetail("");
      try {
        const res = await fetch(cardApiUrl(cardId, "/listings"));
        if (!res.ok) throw new Error("bad");
        const json = await res.json();
        if (!cancelled) {
          setListings(json.listings || []);
          setReason(json.reason || "");
          const bits = [json.status && `HTTP ${json.status}`, json.stage, json.message].filter(Boolean);
          setDetail(bits.join(" — "));
        }
      } catch {
        if (!cancelled) {
          setListings([]);
          setReason("ebay-error");
          setDetail("");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [cardId]);

  return (
    <section className="mt-6">
      <h2 className="text-xl font-extrabold text-navy">For sale on eBay</h2>
      <p className="text-charcoal-400 text-sm mt-1">
        These are cards people are selling right now — not sold prices.
      </p>

      {loading && <p className="mt-3 text-charcoal">Looking up eBay…</p>}

      {!loading && reason === "ebay-error" && (
        <div className="mt-3">
          <p className="text-charcoal">We couldn’t load eBay. Check keys or try again.</p>
          {detail && <p className="mt-1 text-sm text-charcoal-400">{detail}</p>}
        </div>
      )}

      {!loading && reason !== "ebay-error" && listings.length === 0 && (
        <p className="mt-3 text-charcoal">No listings right now.</p>
      )}

      {!loading && listings.length > 0 && (
        <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
          {listings.map((listing) => (
            <ListingCard key={listing.url} listing={listing} />
          ))}
        </div>
      )}
    </section>
  );
}
