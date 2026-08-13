import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login, useAuth } from "../lib/auth";

export default function Login() {
  const { loggedIn, user } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const navigate = useNavigate();

  const handleSubmit = (event) => {
    event.preventDefault();
    login(name);
    navigate("/");
  };

  if (loggedIn) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center">
        <h1 className="text-3xl font-extrabold text-navy mb-3">You are logged in</h1>
        <p className="text-charcoal text-lg mb-6">Hi, {user.name}. This is a demo login on this device.</p>
        <Link
          to="/collection"
          className="inline-flex min-h-12 items-center px-6 rounded-2xl bg-black text-white font-bold"
        >
          Go to My Cards
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <h1 className="text-3xl font-extrabold text-navy mb-3 text-center">Login</h1>
      <p className="text-charcoal text-lg mb-6 text-center">
        Demo login on this device. Not a real account.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="text-left font-semibold text-navy">
          Your name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Collector"
            className="mt-2 w-full min-h-12 px-4 rounded-2xl border-2 border-charcoal-200 focus:outline-none focus:ring-2 focus:ring-baby-blue"
          />
        </label>
        <button
          type="submit"
          className="min-h-12 rounded-2xl bg-black text-white font-bold"
        >
          Log in
        </button>
      </form>
    </div>
  );
}
