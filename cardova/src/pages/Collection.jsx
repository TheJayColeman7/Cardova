import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getSavedCards, toggleSavedCard } from "../lib/collection";
import { useAuth } from "../lib/auth";
import CardThumb from "../components/CardThumb";
import { cardNumberOf, cardSetOf } from "../lib/cards";

export default function Collection() {
  const { loggedIn } = useAuth();
  const navigate = useNavigate();
  const [cards, setCards] = useState([]);

  const refresh = () => setCards(getSavedCards());

  useEffect(() => {
    if (!loggedIn) {
      navigate("/login", { replace: true });
    }
  }, [loggedIn, navigate]);

  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  if (!loggedIn) {
    return null;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-extrabold text-navy mb-2">My Cards</h1>
      <p className="text-charcoal mb-6">Cards you save on this device stay here.</p>

      {cards.length === 0 ? (
        <div>
          <p className="text-lg text-charcoal mb-4">You have not saved any cards yet.</p>
          <Link
            to="/"
            className="inline-flex min-h-12 items-center px-5 rounded-2xl bg-black text-white font-bold"
          >
            Search for a card
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {cards.map((card) => (
            <li key={card.id}>
              <div className="flex gap-3 items-center border border-charcoal-200 rounded-2xl p-3">
                <Link to={`/card/${encodeURIComponent(card.id)}`} className="flex flex-1 gap-3 items-center min-w-0">
                  <CardThumb card={card} className="h-16 w-12 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-bold text-navy truncate">
                      {card.name} #{cardNumberOf(card)}
                    </p>
                    <p className="text-sm text-charcoal-400 truncate">{cardSetOf(card)}</p>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    toggleSavedCard(card);
                    refresh();
                  }}
                  className="text-sm font-semibold text-navy min-h-11 px-3"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
