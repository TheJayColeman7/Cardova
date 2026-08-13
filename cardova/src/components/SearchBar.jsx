import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiSearch, FiCamera } from "react-icons/fi";

export default function SearchBar({ size = "lg" }) {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const large = size === "lg";

  const handleSearch = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <form
      onSubmit={handleSearch}
      className="flex items-center justify-center gap-2 sm:gap-3 w-full max-w-2xl mx-auto"
    >
      <div className="relative flex-1">
        <span className="absolute inset-y-0 left-3 flex items-center text-charcoal-400">
          <FiSearch size={large ? 20 : 18} />
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Try "Mahomes rookie" or "Charizard"'
          className={`w-full pl-11 pr-12 rounded-2xl border-2 border-charcoal-200 bg-white text-charcoal placeholder:text-charcoal-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-baby-blue focus:border-baby-blue ${
            large ? "py-3.5 text-lg min-h-14" : "py-3 min-h-12"
          }`}
        />
        <button
          type="button"
          onClick={() => navigate("/scan")}
          className="absolute inset-y-0 right-2 my-auto h-10 w-10 flex items-center justify-center rounded-xl text-navy hover:bg-baby-blue-50 focus:outline-none focus:ring-2 focus:ring-baby-blue"
          aria-label="Scan a card"
        >
          <FiCamera size={22} />
        </button>
      </div>

      <button
        type="submit"
        className={`rounded-2xl bg-black text-white font-bold shadow flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-baby-blue hover:bg-navy ${
          large ? "px-6 py-3.5 text-lg min-h-14" : "px-5 py-3 min-h-12"
        }`}
      >
        <FiSearch size={18} />
        <span>Search</span>
      </button>
    </form>
  );
}
