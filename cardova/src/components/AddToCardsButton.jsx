import { useEffect, useState } from "react";
import { FiPlus, FiCheck } from "react-icons/fi";
import { isCardSaved, toggleSavedCard } from "../lib/collection";
import { useAuth } from "../lib/auth";

export default function AddToCardsButton({ card, className = "" }) {
  const { loggedIn } = useAuth();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!loggedIn) return;
    setSaved(isCardSaved(card));
  }, [card, loggedIn]);

  if (!loggedIn) return null;

  const handleClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setSaved(toggleSavedCard(card));
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`min-h-11 min-w-11 rounded-xl flex items-center justify-center border-2 focus:outline-none focus:ring-2 focus:ring-baby-blue ${
        saved
          ? "bg-navy text-white border-navy"
          : "bg-white text-navy border-charcoal-200 hover:border-navy"
      } ${className}`}
      aria-label={saved ? "Remove from My Cards" : "Add to My Cards"}
      title={saved ? "Saved in My Cards" : "Add to My Cards"}
    >
      {saved ? <FiCheck size={20} /> : <FiPlus size={20} />}
    </button>
  );
}
