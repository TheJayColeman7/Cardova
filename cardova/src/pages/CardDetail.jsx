import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FiArrowLeft, FiShare2 } from "react-icons/fi";
import CardThumb from "../components/CardThumb";
import AddToCardsButton from "../components/AddToCardsButton";
import { formatDate, formatPrice } from "../lib/format";

export default function CardDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [card, setCard] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [gradeId, setGradeId] = useState("raw");
  const [shareNote, setShareNote] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/cards/${id}`);
        if (res.status === 404) {
          throw new Error("missing");
        }
        if (!res.ok) throw new Error("bad");
        const json = await res.json();
        if (!cancelled) {
          setCard(json);
          setGradeId(json.grades?.[0]?.id || "raw");
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err.message === "missing"
              ? "We could not find that card."
              : "We couldn’t load this card. Try again."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const selectedGrade = useMemo(
    () => card?.grades?.find((grade) => grade.id === gradeId) || card?.grades?.[0],
    [card, gradeId]
  );

  const sales = useMemo(
    () => (card?.sales || []).filter((sale) => sale.gradeId === selectedGrade?.id),
    [card, selectedGrade]
  );

  const handleShare = async () => {
    const url = window.location.href;
    const title = card ? `${card.name} #${card.number}` : "Sweet Home Cards";
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareNote("Link copied");
      setTimeout(() => setShareNote(""), 2000);
    } catch {
      setShareNote("");
    }
  };

  if (loading) {
    return <p className="max-w-3xl mx-auto px-4 py-10 text-charcoal">Loading card…</p>;
  }

  if (error || !card) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <p className="text-lg font-semibold text-navy mb-4">{error || "We could not find that card."}</p>
        <Link to="/search" className="text-baby-blue-600 font-bold">
          Back to search
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-[calc(100vh-64px)]">
      <div className="max-w-3xl mx-auto px-3 py-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="min-h-11 min-w-11 rounded-full flex items-center justify-center text-navy hover:bg-charcoal-50"
          aria-label="Back"
        >
          <FiArrowLeft size={22} />
        </button>
        <h1 className="flex-1 text-center font-bold text-navy text-lg truncate">{card.name}</h1>
        <button
          type="button"
          onClick={handleShare}
          className="min-h-11 min-w-11 rounded-full flex items-center justify-center text-navy hover:bg-charcoal-50"
          aria-label="Share"
        >
          <FiShare2 size={20} />
        </button>
        <AddToCardsButton card={card} />
      </div>
      {shareNote && <p className="text-center text-sm text-navy">{shareNote}</p>}

      <div className="max-w-3xl mx-auto px-4 pb-10">
        <div className="flex gap-4 items-start">
          <CardThumb card={card} className="h-40 w-28 shrink-0" />
          <div className="min-w-0">
            <p className="text-2xl font-extrabold text-navy">
              {card.name} #{card.number}
            </p>
            {card.variant && (
              <span className="inline-block mt-2 text-xs font-semibold uppercase tracking-wide border border-charcoal-300 text-charcoal px-1.5 py-0.5 rounded">
                {card.variant}
              </span>
            )}
            <p className="mt-3 inline-flex items-center rounded-full bg-charcoal-50 border border-charcoal-200 px-3 py-1 text-sm font-semibold text-navy">
              {card.set}
            </p>
          </div>
        </div>

        {card.sample && (
          <p className="text-sm text-charcoal-400 mt-4">Sample prices — not live market data yet.</p>
        )}

        <div className="mt-5 flex gap-3 overflow-x-auto pb-1">
          {(card.marketplaces || []).map((market) => (
            <div
              key={market.name}
              className="min-w-[140px] rounded-2xl border border-charcoal-200 px-4 py-3"
            >
              <p className="text-sm font-semibold text-charcoal-400">{market.name}</p>
              <p className="text-xl font-extrabold text-navy">{formatPrice(market.price)}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 flex gap-3 overflow-x-auto pb-1">
          {(card.grades || []).map((grade) => {
            const selected = grade.id === selectedGrade?.id;
            return (
              <button
                key={grade.id}
                type="button"
                onClick={() => setGradeId(grade.id)}
                className={`min-w-[108px] shrink-0 min-h-16 rounded-2xl px-3 py-3 text-left border-2 ${
                  selected
                    ? "bg-navy text-white border-navy"
                    : "bg-white text-charcoal border-charcoal-200"
                }`}
              >
                <span className="block text-sm font-semibold">{grade.label}</span>
                <span className="block text-xl font-extrabold">{formatPrice(grade.price)}</span>
              </button>
            );
          })}
        </div>

        {selectedGrade && (
          <p className="mt-5 text-2xl font-extrabold text-navy">
            About {formatPrice(selectedGrade.price)}
          </p>
        )}

        <div className="mt-8">
          <h2 className="text-xl font-extrabold text-navy">{selectedGrade?.label} sales</h2>
          <p className="text-charcoal-400 text-sm mt-1">
            {sales.length} sale{sales.length === 1 ? "" : "s"} in our sample
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-baby-blue-600 text-sm">
                  <th className="py-2 pr-3 font-semibold">Date</th>
                  <th className="py-2 pr-3 font-semibold">Title</th>
                  <th className="py-2 font-semibold text-right">Price</th>
                </tr>
              </thead>
              <tbody>
                {sales.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-6 text-charcoal">
                      No sample sales for this grade yet.
                    </td>
                  </tr>
                )}
                {sales.map((sale, index) => (
                  <tr
                    key={`${sale.date}-${sale.title}`}
                    className={index % 2 === 0 ? "bg-white" : "bg-charcoal-50"}
                  >
                    <td className="py-3 pr-3 whitespace-nowrap">{formatDate(sale.date)}</td>
                    <td className="py-3 pr-3 font-medium text-charcoal">
                      {sale.url ? (
                        <a href={sale.url} className="text-baby-blue-600" target="_blank" rel="noreferrer">
                          {sale.title}
                        </a>
                      ) : (
                        sale.title
                      )}
                    </td>
                    <td className="py-3 font-bold text-navy text-right whitespace-nowrap">
                      {formatPrice(sale.price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
