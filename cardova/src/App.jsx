import { Routes, Route } from "react-router-dom";
import Header from "./components/Header";

import Home from "./pages/Home";
import SearchResults from "./pages/SearchResults";
import Collection from "./pages/Collection"; // if created
import Login from "./pages/Login"; // if created

function App() {
  return (
    <div className="min-h-screen bg-navy-700 text-gray-900">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<SearchResults />} />
          <Route path="/collection" element={<Collection />} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
