import { useEffect, useState } from "react";

export default function CardThumb({ card, className = "" }) {
  const letter = (card?.name || "?").charAt(0).toUpperCase();
  const [broken, setBroken] = useState(false);
  const src = !broken && (card?.image || (card?.id ? `/cards/${card.id}.jpg` : null));

  useEffect(() => {
    setBroken(false);
  }, [card?.id, card?.image]);

  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-navy text-white flex items-center justify-center ${className}`}
      aria-hidden="true"
    >
      {src ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <div className="flex flex-col items-center justify-center px-2 text-center">
          <span className="font-display text-2xl font-bold text-baby-blue">{letter}</span>
          <span className="text-[10px] uppercase tracking-wide text-baby-blue-100 leading-tight mt-1">
            {card?.category}
          </span>
        </div>
      )}
    </div>
  );
}
