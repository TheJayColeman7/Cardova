import { useState } from "react";
import { Link } from "react-router-dom";
import { FiMenu, FiX } from "react-icons/fi";

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);
  const closeMenu = () => setIsOpen(false);

  return (
    <header className="bg-navy text-white shadow">
      <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
        {/* Logo */}
        <Link to="/" className="text-2xl font-bold tracking-tight" onClick={closeMenu}>
          Cardova
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden sm:flex space-x-6 text-sm font-medium">
          <Link to="/" className="hover:text-babyblue transition">Home</Link>
          <Link to="/collection" className="hover:text-babyblue transition">My Collection</Link>
          <Link to="/login" className="hover:text-babyblue transition">Login</Link>
        </nav>

        {/* Mobile Toggle */}
        <div className="sm:hidden">
          <button onClick={toggleMenu} className="text-white text-2xl focus:outline-none">
            {isOpen ? <FiX /> : <FiMenu />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Nav */}
      {isOpen && (
        <div className="sm:hidden px-4 pb-4 space-y-3 bg-navy text-white">
          <Link to="/" className="block hover:text-babyblue transition" onClick={closeMenu}>Home</Link>
          <Link to="/collection" className="block hover:text-babyblue transition" onClick={closeMenu}>My Collection</Link>
          <Link to="/login" className="block hover:text-babyblue transition" onClick={closeMenu}>Login</Link>
        </div>
      )}
    </header>
  );
} 