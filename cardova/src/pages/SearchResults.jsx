import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FiArrowLeft, FiCamera, FiSearch, FiX, FiGrid, FiList } from "react-icons/fi";
import SearchResultRow from "../components/SearchResultRow";

export default function SearchResults() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const query = params.get("q") || "";
  const fromScan = params.get("from") === "scan";

  const [input, setInput] = useState(query);
  const [sort, setSort] = useState("name");
  const [setFilter, setSetFilter] = useState("");
  const [sportsOnly, setSportsOnly] = useState(false);
  const [includeVariants, setIncludeVariants] = useState(true);
  const [view, setView] = useState("list");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scanPhoto, setScanPhoto] = useState(null);

  useEffect(() => {
    setInput(query);
  }, [query]);

  useEffect(() => {
    try {
      setScanPhoto(sessionStorage.getItem("shc-scan-photo"));
    } catch {
      setScanPhoto(null);
    }
  }, [fromScan]);

  useEffect(() => {
    let cancelled = false;
    const fetchCards = async () => {
      setLoading(true);
      setError("");
      const search = new URLSearchParams();
      if (query) search.set("q", query);
      search.set("sort", sort);
      if (setFilter) search.set("set", setFilter);
      if (sportsOnly) search.set("category", "Sports");
      if (!includeVariants) search.set("variants", "false");

      try {
        const res = await fetch(`/api/cards?${search.toString()}`);
        if (!res.ok) throw new Error("bad response");
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) {
          setData({ results: [], sets: [] });
          setError("We couldn’t look that up. Try again in a moment.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchCards();
    return () => {
      cancelled = true;
    };
  }, [query, sort, setFilter, sportsOnly, includeVariants]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const next = new URLSearchParams(params);
    if (input.trim()) next.set("q", input.trim());
    else next.delete("q");
    setParams(next);
  };

  const results = data?.results || [];
  const sets = data?.sets || [];
  const empty = !loading && results.length === 0;

  const grid = useMemo(
    () => view === "grid",
    [view]
  );

  return (
    <div className="bg-white min-h-[calc(100vh-64px)]">
      <div className="sticky top-0 z-30 bg-white border-b border-charcoal-100">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-3 py-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="min-h-11 min-w-11 rounded-full flex items-center justify-center text-navy hover:bg-charcoal-50"
            aria-label="Back"
          >
            <FiArrowLeft size={22} />
          </button>
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-400" />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Search"
              className="w-full min-h-12 pl-10 pr-10 rounded-full border border-charcoal-200 focus:outline-none focus:ring-2 focus:ring-baby-blue"
            />
            {input && (
              <button
                type="button"
                onClick={() => setInput("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-400"
                aria-label="Clear search"
              >
                <FiX size={18} />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => navigate("/scan")}
            className="min-h-11 min-w-11 rounded-full flex items-center justify-center text-navy hover:bg-charcoal-50"
            aria-label="Scan a card"
          >
            <FiCamera size={22} />
          </button>
        </form>

        <div className="max-w-3xl mx-auto px-3 pb-3 flex items-center gap-2 overflow-x-auto">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="min-h-10 rounded-full border border-charcoal-200 px-3 text-sm font-semibold bg-white"
            aria-label="Sort"
          >
            <option value="name">Sort: Name</option>
            <option value="price-high">Sort: Price high</option>
            <option value="price-low">Sort: Price low</option>
          </select>
          <button
            type="button"
            onClick={() => setSportsOnly((on) => !on)}
            className={`min-h-10 whitespace-nowrap rounded-full px-3 text-sm font-semibold border ${
              sportsOnly
                ? "bg-navy text-white border-navy"
                : "bg-white text-charcoal border-charcoal-200"
            }`}
          >
            Sports Cards
          </button>
          <select
            value={setFilter}
            onChange={(e) => setSetFilter(e.target.value)}
            className="min-h-10 rounded-full border border-charcoal-200 px-3 text-sm font-semibold bg-white"
            aria-label="Set"
          >
            <option value="">Set</option>
            {sets.map((setName) => (
              <option key={setName} value={setName}>
                {setName}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setIncludeVariants((on) => !on)}
            className={`min-h-10 whitespace-nowrap rounded-full px-3 text-sm font-semibold border ${
              includeVariants
                ? "bg-black text-white border-black"
                : "bg-white text-charcoal border-charcoal-200"
            }`}
          >
            Include variations
          </button>
          <button
            type="button"
            onClick={() => setView((v) => (v === "list" ? "grid" : "list"))}
            className="min-h-10 min-w-10 rounded-full border border-charcoal-200 flex items-center justify-center ml-auto"
            aria-label={grid ? "List view" : "Grid view"}
          >
            {grid ? <FiList size={18} /> : <FiGrid size={18} />}
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-3 py-4">
        {fromScan && (
          <div className="mb-4 flex items-center gap-3 bg-baby-blue-50 border border-baby-blue-200 rounded-2xl p-3">
            {scanPhoto && (
              <img src={scanPhoto} alt="" className="h-14 w-10 object-cover rounded" />
            )}
            <p className="font-semibold text-navy">Searching from your photo</p>
          </div>
        )}

        {query && (
          <h1 className="text-xl font-bold text-navy mb-3">
            Results for: {query}
          </h1>
        )}

        {data?.sample && !empty && (
          <p className="text-sm text-charcoal-400 mb-3">Sample prices — not live market data yet.</p>
        )}

        {loading && <p className="text-charcoal py-8">Looking up cards…</p>}
        {error && <p className="text-navy font-semibold py-4">{error}</p>}
        {empty && (
          <p className="text-charcoal text-lg py-8">
            We couldn’t find that card. Try the player’s name.
          </p>
        )}

        {!loading && results.length > 0 && (
          <div className={grid ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : "flex flex-col gap-3"}>
            {results.map((card) => (
              <SearchResultRow key={card.id} card={card} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
