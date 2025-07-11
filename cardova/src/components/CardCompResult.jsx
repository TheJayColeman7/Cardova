import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

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

      {/* Price Graph */}
      <div className="mt-6 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.chartData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" stroke="#374151" />
            <YAxis stroke="#374151" />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="price"
              stroke="#1e3a8a"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
  