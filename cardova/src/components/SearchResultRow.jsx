import { Link } from "react-router-dom";
import CardThumb from "./CardThumb";
import AddToCardsButton from "./AddToCardsButton";
import { formatPrice } from "../lib/format";
import { cardNumberOf, cardSetOf, findSamplePrice } from "../lib/cards";

function badge(card) {
  if (card.variation) return card.variation;
  if (card.finish) return card.finish;
  if (card.parallel) return card.parallel;
  if (card.rookie) return "Rookie";
  return card.variant || null;
}

export default function SearchResultRow({ item }) {
  const card = item.card;
  const samplePrices = item.samplePrices || [];
  const raw = findSamplePrice(samplePrices, null, null);
  const psa10 = findSamplePrice(samplePrices, "PSA", "10");
  const label = badge(card);

  return (
    <Link
      to={`/card/${encodeURIComponent(card.id)}`}
      className="flex gap-3 items-stretch bg-white border border-charcoal-200 rounded-2xl p-3 hover:border-navy focus:outline-none focus:ring-2 focus:ring-baby-blue"
    >
      <CardThumb card={card} className="h-24 w-16 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-navy text-lg leading-tight">
          {card.name} #{cardNumberOf(card)}
        </p>
        {label && (
          <span className="inline-block mt-1 text-xs font-semibold uppercase tracking-wide border border-charcoal-300 text-charcoal px-1.5 py-0.5 rounded">
            {label}
          </span>
        )}
        <p className="text-xs uppercase tracking-wide text-charcoal-400 mt-2">
          {cardSetOf(card)}
        </p>
        {(raw || psa10) && (
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm font-semibold text-charcoal">
            <span>Sample raw {formatPrice(raw?.price)}</span>
            <span className="text-charcoal-300">|</span>
            <span>Sample PSA 10 {formatPrice(psa10?.price)}</span>
          </div>
        )}
      </div>
      <div className="flex items-center">
        <AddToCardsButton card={card} />
      </div>
    </Link>
  );
}
