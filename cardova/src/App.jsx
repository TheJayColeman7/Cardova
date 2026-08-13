import { Routes, Route, useLocation } from "react-router-dom";
import Header from "./components/Header.jsx";

import Home from "./pages/Home.jsx";
import SearchResults from "./pages/SearchResults.jsx";
import CardDetail from "./pages/CardDetail.jsx";
import Collection from "./pages/Collection.jsx";
import Login from "./pages/Login.jsx";
import Scan from "./pages/Scan.jsx";

function App() {
  const location = useLocation();
  const hideHeader = location.pathname === "/scan";

  return (
    <div className="min-h-screen bg-white text-charcoal">
      {!hideHeader && <Header />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/search" element={<SearchResults />} />
        <Route path="/card/:id" element={<CardDetail />} />
        <Route path="/collection" element={<Collection />} />
        <Route path="/login" element={<Login />} />
        <Route path="/scan" element={<Scan />} />
      </Routes>
    </div>
  );
}

export default App;
