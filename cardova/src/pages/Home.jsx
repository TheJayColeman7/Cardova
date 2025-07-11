import SearchBar from "../components/SearchBar";

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-gray-800">
      <header className="bg-navy text-white py-6 shadow">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="text-3xl font-bold">Cardova</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h2 className="text-4xl font-semibold text-gray-900 mb-2">
            Search Smarter. Track Better.
          </h2>
          <p className="text-gray-600 text-lg">
            Find card prices across top platforms. Track your collection with ease.
          </p>
        </div>

        <div className="mb-12">
          <SearchBar />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div className="p-6 bg-gray-50 rounded-lg shadow hover:shadow-md transition">
            <h3 className="text-xl font-semibold text-navy">Smart Search</h3>
            <p className="text-gray-600 mt-2">
              Quickly find comps and pricing from trusted platforms.
            </p>
          </div>
          <div className="p-6 bg-gray-50 rounded-lg shadow hover:shadow-md transition">
            <h3 className="text-xl font-semibold text-navy">Fast Results</h3>
            <p className="text-gray-600 mt-2">
              Instantly access up-to-date market data.
            </p>
          </div>
          <div className="p-6 bg-gray-50 rounded-lg shadow hover:shadow-md transition">
            <h3 className="text-xl font-semibold text-navy">Clean Tracking</h3>
            <p className="text-gray-600 mt-2">
              Save and monitor your collection in one place.
            </p>
          </div>
        </div>

        <div className="mt-16 text-center">
          <h3 className="text-2xl font-semibold text-gray-800 mb-2">
            Ready to get started?
          </h3>
          <p className="text-gray-600 mb-4">
            Join collectors who trust Cardova to stay ahead of the market.
          </p>
          <button className="bg-charcoal-100 text-charcoal-900 font-medium px-6 py-3 rounded-lg shadow transition focus:ring-2 focus:ring-baby-blue-500 hover:bg-navy-600 hover:text-white hover:shadow-md">
            Start Searching Now
          </button>
        </div>
      </main>

      <footer className="bg-charcoal text-white py-4 mt-12">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm">
          © {new Date().getFullYear()} Cardova. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
