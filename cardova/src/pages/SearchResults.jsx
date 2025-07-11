// src/pages/SearchResults.jsx
import { Search, ArrowLeft, Filter, Star } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

function SearchResults() {
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const query = searchParams.get('q') || '';

  useEffect(() => {
    setSearchQuery(query);
    if (query) {
      performSearch(query);
    }
  }, [query]);

  const performSearch = async (searchTerm) => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      const mockResults = [
        {
          id: 1,
          title: `Search result for "${searchTerm}" - Example 1`,
          description: 'This is a sample search result that demonstrates how the search functionality works. It includes relevant content that matches your search query.',
          url: 'https://example.com/result1',
          rating: 4.5
        },
        {
          id: 2,
          title: `Another result for "${searchTerm}" - Example 2`,
          description: 'Another sample search result with different content. This shows the variety of results you can expect from your searches.',
          url: 'https://example.com/result2',
          rating: 4.2
        },
        {
          id: 3,
          title: `Third result for "${searchTerm}" - Example 3`,
          description: 'A third example result to show the search results layout and styling. Each result includes a title, description, and rating.',
          url: 'https://example.com/result3',
          rating: 4.8
        }
      ];
      setResults(mockResults);
      setLoading(false);
    }, 1000);
  };

  const handleNewSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <div className="min-h-screen bg-charcoal-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-baby-blue-600 hover:text-baby-blue-800 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>
          
          <form onSubmit={handleNewSearch} className="max-w-2xl">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for anything..."
                className="w-full px-4 py-3 pl-12 pr-16 text-charcoal-900 bg-white border border-charcoal-300 rounded-lg focus:ring-2 focus:ring-baby-blue-500 focus:border-transparent"
              />
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-charcoal-400 w-5 h-5" />
              <button
                type="submit"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-navy-600 text-white px-4 py-1 rounded-md hover:bg-navy-700 transition-colors"
              >
                Search
              </button>
            </div>
          </form>
        </div>

        {/* Search Results */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-navy-900">
              Search Results for "{query}"
            </h2>
            <button className="flex items-center gap-2 text-charcoal-600 hover:text-charcoal-800">
              <Filter className="w-4 h-4" />
              Filters
            </button>
          </div>
          
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-baby-blue-600 mx-auto mb-4"></div>
              <p className="text-charcoal-600">Searching...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {results.map((result) => (
                <div key={result.id} className="bg-white p-6 rounded-lg shadow-sm border border-charcoal-200 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-semibold text-baby-blue-600 hover:text-baby-blue-800">
                      <a href={result.url} target="_blank" rel="noopener noreferrer">
                        {result.title}
                      </a>
                    </h3>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-400 fill-current" />
                      <span className="text-sm text-charcoal-600">{result.rating}</span>
                    </div>
                  </div>
                  <p className="text-charcoal-600 mb-3">{result.description}</p>
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-baby-blue-600 hover:text-baby-blue-800"
                  >
                    {result.url}
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* No Results */}
        {!loading && results.length === 0 && query && (
          <div className="text-center py-12">
            <Search className="w-16 h-16 text-charcoal-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-navy-900 mb-2">No results found</h3>
            <p className="text-charcoal-600 mb-4">
              We couldn't find any results for "{query}". Try different keywords or check your spelling.
            </p>
            <button
              onClick={() => navigate('/')}
              className="bg-navy-600 text-white px-6 py-2 rounded-lg hover:bg-navy-700 transition-colors"
            >
              Back to Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default SearchResults;
