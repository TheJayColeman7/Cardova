import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { FiMenu, FiX } from "react-icons/fi";
import FocusTrap from "focus-trap-react"; // install this if needed

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [animateOut, setAnimateOut] = useState(false);

  const location = useLocation();

  const isActive = (path) => location.pathname === path;
  
  const closeMenu = () => {
    setAnimateOut(true);
    setTimeout(() => {
      setIsOpen(false);
      setAnimateOut(false);
    }, 300); // match your CSS animation duration
  };

  const toggleMenu = () => {
    setIsOpen(true);
    setAnimateOut(false);
  };

  const navLinkStyle = (path) =>
    `hover:text-babyblue transition ${
      isActive(path) ? "underline underline-offset-4 decoration-babyblue" : ""
    }`;

  return (
    <>
      <header className="bg-navy text-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link to="/" className="text-2xl font-bold tracking-tight" onClick={closeMenu}>
            Cardova
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden sm:flex space-x-6 text-sm font-medium">
            <Link to="/" className={navLinkStyle("/")}>Home</Link>
            <Link to="/collection" className={navLinkStyle("/collection")}>My Collection</Link>
            <Link to="/login" className={navLinkStyle("/login")}>Login</Link>
          </nav>

          {/* Mobile Toggle */}
          <div className="sm:hidden">
            <button
              onClick={toggleMenu}
              className="text-white text-2xl focus:outline-none relative w-8 h-8"
            >
              <div className="absolute inset-0 flex items-center justify-center transition-all duration-300 ease-in-out transform scale-100 opacity-100">
                <FiMenu
                  size={24}
                  className={`transition-all duration-300 ${
                    isOpen ? "opacity-0 scale-75 rotate-45" : "opacity-100 scale-100"
                  }`}
                />
              </div>
              <div className="absolute inset-0 flex items-center justify-center transition-all duration-300 ease-in-out transform scale-100 opacity-100">
                <FiX
                  size={24}
                  className={`transition-all duration-300 ${
                    isOpen ? "opacity-100 scale-100 rotate-0" : "opacity-0 scale-75 -rotate-45"
                  }`}
                />
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Animated Backdrop */}
      {isOpen && (
        <div
          className={`fixed inset-0 bg-black z-40 transition-opacity duration-300 ${
            animateOut ? "opacity-0" : "opacity-40"
          }`}
          onClick={closeMenu}
        />
      )}

      {/* Animated Mobile Drawer */}
      {isOpen && (
        <FocusTrap active={isOpen}>
          <div
            className={`sm:hidden fixed top-0 right-0 h-full w-64 bg-baby-blue-500 text-white px-6 py-6 z-50 shadow-lg transition-transform duration-300 ${
              animateOut ? "animate-slide-out" : "animate-slide-in"
            }`}
          >
            {/* Close Button */}
            <div className="flex justify-end mb-6">
              <button
                onClick={closeMenu}
                className="text-white hover:text-gray-300 transition-colors focus:outline-none"
              >
                <FiX size={24} />
              </button>
            </div>

            <nav className="flex flex-col space-y-4">
              <Link to="/" onClick={closeMenu} className="hover:text-babyblue block py-2 rounded">
                Home
              </Link>
              <Link to="/collection" onClick={closeMenu} className="hover:text-babyblue block py-2 rounded">
                My Collection
              </Link>
              <Link to="/login" onClick={closeMenu} className="hover:text-babyblue block py-2 rounded">
                Login
              </Link>
            </nav>
          </div>
        </FocusTrap>
      )}
    </>
  );
} 