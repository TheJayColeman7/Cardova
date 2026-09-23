import { useEffect, useState } from "react";

function thumbSrc(card, preferLarge) {
  if (preferLarge && card?.imageLargeUrl) return card.imageLargeUrl;
  if (card?.imageSmallUrl) return card.imageSmallUrl;
  if (card?.imageLargeUrl) return card.imageLargeUrl;
  if (card?.image) return card.image;
  const fileId = card?.source === "catalog" ? card.sourceId : !card?.source && card?.id && !String(card.id).includes(":") ? card.id : null;
  return fileId ? `/cards/${fileId}.jpg` : null;
}

export default function CardThumb({ card, className = "", preferLarge = false }) {
  const letter = (card?.name || "?").charAt(0).toUpperCase();
  const [broken, setBroken] = useState(false);
  const src = !broken && thumbSrc(card, preferLarge);

  useEffect(() => {
    setBroken(false);
  }, [card?.id, card?.image, card?.imageSmallUrl, card?.imageLargeUrl, preferLarge]);

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
            {card?.sport || card?.game || card?.category}
          </span>
        </div>
      )}
    </div>
  );
}
