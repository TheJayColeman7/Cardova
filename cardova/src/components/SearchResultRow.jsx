import { Link } from "react-router-dom";
import CardThumb from "./CardThumb";
import AddToCardsButton from "./AddToCardsButton";
import { formatPrice } from "../lib/format";

export default function SearchResultRow({ card }) {
  return (
    <Link
      to={`/card/${card.id}`}
      className="flex gap-3 items-stretch bg-white border border-charcoal-200 rounded-2xl p-3 hover:border-navy focus:outline-none focus:ring-2 focus:ring-baby-blue"
    >
      <CardThumb card={card} className="h-24 w-16 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-navy text-lg leading-tight">
          {card.name} #{card.number}
        </p>
        {card.variant && (
          <span className="inline-block mt-1 text-xs font-semibold uppercase tracking-wide border border-charcoal-300 text-charcoal px-1.5 py-0.5 rounded">
            {card.variant}
          </span>
        )}
        <p className="text-xs uppercase tracking-wide text-charcoal-400 mt-2">
          {card.set}
        </p>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm font-semibold text-charcoal">
          <span>Raw {formatPrice(card.rawPrice)}</span>
          <span className="text-charcoal-300">|</span>
          <span>PSA 10 {formatPrice(card.psa10Price)}</span>
        </div>
      </div>
      <div className="flex items-center">
        <AddToCardsButton card={card} />
      </div>
    </Link>
  );
}
