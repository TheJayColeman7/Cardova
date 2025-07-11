// src/components/CardCompResult.jsx
export default function CardCompResult({ data }) {
  return (
    <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200 mb-6">
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{data.title}</h3>

      <div className="text-gray-700 space-y-1">
        <p>
          <span className="font-medium text-gray-600">Average Price:</span>{" "}
          <span className="text-green-600 font-semibold">{data.averagePrice}</span>
        </p>
        <p>
          <span className="font-medium text-gray-600">Last Sold:</span>{" "}
          {data.lastSold} on {data.soldOn}{" "}
          <span className="text-sm text-gray-400">({data.soldDate})</span>
        </p>
      </div>

      {/* Placeholder for chart */}
      <div className="mt-6 bg-gray-100 rounded-md h-40 flex items-center justify-center text-sm text-gray-400">
        [Price Trend Graph Coming Soon]
      </div>
    </div>
  );
} 