import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import CardCompResult from "../components/CardCompResult";

export default function SearchResults() {
  const location = useLocation();
  const query = new URLSearchParams(location.search).get("q");

  const [compData, setCompData] = useState(null);

  useEffect(() => {
    if (!query) return;

    // Simulate async API call
    const fetchCompData = async () => {
      try {
        const res = await fetch(`http://localhost:3001/api/comps?q=${encodeURIComponent(query)}`);
        const response = await res.json();
        setCompData(response);
      } catch (error) {
        console.error('Error fetching comp data:', error);
        // Fallback to mock data if API fails
        const fallbackResponse = {
          title: `${query} - Auto PSA 10`,
          averagePrice: "$820",
          lastSold: "$850",
          soldOn: "eBay",
          soldDate: "2025-07-08",
          chartData: [
            { date: "Jul 01", price: 750 },
            { date: "Jul 03", price: 800 },
            { date: "Jul 05", price: 790 },
            { date: "Jul 08", price: 850 },
          ],
        };
        setCompData(fallbackResponse);
      }
    };

    fetchCompData();
  }, [query]);

  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold mb-6 text-white">
        Results for: <span className="text-navy">{query}</span>
      </h2>

      {compData ? (
        <CardCompResult data={compData} />
      ) : (
        <p className="text-gray-500">Loading comp data...</p>
      )}
    </div>
  );
}
