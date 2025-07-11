// src/components/SearchBar.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiSearch } from "react-icons/fi"; // Feather icon for search
import { ImSpinner2 } from "react-icons/im"; // Spinner icon

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);

    // Simulate a short delay to show spinner
    setTimeout(() => {
      navigate(`/search?q=${encodeURIComponent(query)}`);
      setLoading(false);
    }, 1000);
  };

  return (
    <form
      onSubmit={handleSearch}
      className="flex items-center justify-center gap-3 w-full max-w-2xl mx-auto"
    >
      <div className="relative flex-1">
        <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
          <FiSearch size={18} />
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search cards (e.g. PSA 10 Charizard, Mahomes Rookie)"
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-baby-blue-500 text-gray-800 placeholder:text-gray-400"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className={`px-6 py-3 rounded-xl bg-charcoal-100 text-charcoal-900 font-medium shadow transition flex items-center gap-2 focus:ring-2 focus:ring-baby-blue-500 hover:bg-navy-600 hover:text-white hover:shadow-md ${
          loading ? "cursor-not-allowed opacity-80" : ""
        }`}
      >
        {loading ? (
          <ImSpinner2 className="animate-spin text-white" size={18} />
        ) : (
          <FiSearch size={18} />
        )}
        <span>{loading ? "Searching..." : "Search"}</span>
      </button>
    </form>
  );
}
