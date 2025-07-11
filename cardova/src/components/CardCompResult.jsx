// src/components/CardCompResult.jsx
export default function CardCompResult({ data }) {
    return (
      <div className="border p-4 rounded bg-white shadow">
        <h3 className="text-lg font-bold">{data.title}</h3>
        <p>Average Price: <strong>{data.averagePrice}</strong></p>
        <p>Last Sold: {data.lastSold} on {data.soldOn} ({data.soldDate})</p>
        {/* Placeholder for price graph */}
        <div className="mt-4 h-24 bg-gray-100 text-center flex items-center justify-center text-sm text-gray-500">
          [Graph Placeholder]
        </div>
      </div>
    );
  }
  