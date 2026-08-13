import { useNavigate } from "react-router-dom";
import SearchBar from "../components/SearchBar";
import { useAuth } from "../lib/auth";

export default function Home() {
  const navigate = useNavigate();
  const { loggedIn } = useAuth();

  return (
    <div className="bg-white text-charcoal">
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-navy mb-3">
            Find out what your cards are worth.
          </h1>
          <p className="text-charcoal text-lg sm:text-xl">
            Search a name, or scan a card with your camera.
          </p>
        </div>

        <div className="mb-12">
          <SearchBar />
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => navigate("/scan")}
              className="min-h-12 px-6 rounded-2xl border-2 border-navy text-navy font-bold hover:bg-navy hover:text-white focus:outline-none focus:ring-2 focus:ring-baby-blue"
            >
              Scan a card
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <div className="p-6 bg-charcoal-50 rounded-2xl border border-charcoal-100">
            <h2 className="text-xl font-bold text-navy">Search</h2>
            <p className="text-charcoal mt-2">Type a player or card name.</p>
          </div>
          <div className="p-6 bg-charcoal-50 rounded-2xl border border-charcoal-100">
            <h2 className="text-xl font-bold text-navy">See the price</h2>
            <p className="text-charcoal mt-2">What it sold for lately.</p>
          </div>
          <div className="p-6 bg-charcoal-50 rounded-2xl border border-charcoal-100">
            <h2 className="text-xl font-bold text-navy">Scan</h2>
            <p className="text-charcoal mt-2">Take a photo, then type the name.</p>
          </div>
        </div>

        {loggedIn && (
          <div className="mt-16 text-center">
            <h2 className="text-2xl font-bold text-navy mb-2">Your cards</h2>
            <p className="text-charcoal mb-4">Keep a list of cards you own.</p>
            <button
              type="button"
              onClick={() => navigate("/collection")}
              className="min-h-12 bg-black text-white font-bold px-6 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-baby-blue"
            >
              Go to My Cards
            </button>
          </div>
        )}
      </main>

      <footer className="bg-charcoal text-white py-4 mt-12">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm">
          © {new Date().getFullYear()} Sweet Home Cards. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
