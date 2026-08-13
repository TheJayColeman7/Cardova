import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { FiMenu, FiX } from "react-icons/fi";
import FocusTrap from "focus-trap-react";
import Logo from "./Logo";
import { logout, useAuth } from "../lib/auth";

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [animateOut, setAnimateOut] = useState(false);
  const location = useLocation();
  const { loggedIn } = useAuth();

  const isActive = (path) => location.pathname === path;

  const closeMenu = () => {
    if (!isOpen) return;
    setAnimateOut(true);
    setTimeout(() => {
      setIsOpen(false);
      setAnimateOut(false);
    }, 300);
  };

  const toggleMenu = () => {
    if (isOpen) {
      closeMenu();
    } else {
      setIsOpen(true);
      setAnimateOut(false);
    }
  };

  const navLinkStyle = (path) =>
    `text-base font-semibold hover:text-baby-blue transition ${
      isActive(path) ? "underline underline-offset-4 decoration-baby-blue" : ""
    }`;

  const links = loggedIn
    ? [
        { to: "/", label: "Home" },
        { to: "/collection", label: "My Cards" },
      ]
    : [{ to: "/", label: "Home" }];

  return (
    <>
      <header className="bg-navy text-white">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center gap-4">
          <Link to="/" className="min-w-0" onClick={closeMenu} aria-label="Sweet Home Sports Cards home">
            <Logo variant="dark" compact />
          </Link>

          <nav className="hidden sm:flex items-center space-x-6">
            {links.map((link) => (
              <Link key={link.to} to={link.to} className={navLinkStyle(link.to)}>
                {link.label}
              </Link>
            ))}
            {loggedIn ? (
              <button
                type="button"
                onClick={logout}
                className="text-base font-semibold hover:text-baby-blue"
              >
                Log out
              </button>
            ) : (
              <Link to="/login" className={navLinkStyle("/login")}>
                Login
              </Link>
            )}
          </nav>

          <div className="sm:hidden">
            <button
              type="button"
              onClick={toggleMenu}
              className="text-white text-2xl focus:outline-none focus:ring-2 focus:ring-baby-blue rounded-lg p-2 min-h-11 min-w-11"
              aria-label={isOpen ? "Close menu" : "Open menu"}
              aria-expanded={isOpen}
            >
              {isOpen ? <FiX size={24} /> : <FiMenu size={24} />}
            </button>
          </div>
        </div>
      </header>

      {isOpen && (
        <div
          className={`fixed inset-0 bg-black z-40 transition-opacity duration-300 ${
            animateOut ? "opacity-0" : "opacity-40"
          }`}
          onClick={closeMenu}
        />
      )}

      {isOpen && (
        <FocusTrap active={isOpen}>
          <div
            className={`sm:hidden fixed top-0 right-0 h-full w-64 bg-navy text-white px-6 py-6 z-50 transition-transform duration-300 ${
              animateOut ? "animate-slide-out" : "animate-slide-in"
            }`}
            tabIndex={-1}
          >
            <div className="flex justify-end mb-6">
              <button
                type="button"
                onClick={closeMenu}
                className="text-white hover:text-baby-blue transition-colors focus:outline-none focus:ring-2 focus:ring-baby-blue rounded-lg p-2 min-h-11 min-w-11"
                aria-label="Close menu"
              >
                <FiX size={24} />
              </button>
            </div>

            <nav className="flex flex-col space-y-2">
              {links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={closeMenu}
                  className="hover:text-baby-blue block py-3 text-lg font-semibold rounded"
                >
                  {link.label}
                </Link>
              ))}
              {loggedIn ? (
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    closeMenu();
                  }}
                  className="hover:text-baby-blue block py-3 text-lg font-semibold rounded text-left"
                >
                  Log out
                </button>
              ) : (
                <Link
                  to="/login"
                  onClick={closeMenu}
                  className="hover:text-baby-blue block py-3 text-lg font-semibold rounded"
                >
                  Login
                </Link>
              )}
            </nav>
          </div>
        </FocusTrap>
      )}
    </>
  );
}
