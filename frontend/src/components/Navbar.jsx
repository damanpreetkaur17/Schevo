
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Sun,
  Moon,
  Menu,
  X,
  ArrowUpRight,
} from "lucide-react";

import { useTheme } from "../context/ThemeContext";

const Navbar = () => {
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  const navLinks = [
    { name: "How It Works", href: "#how-it-works" },
    { name: "Features", href: "#features" },
    { name: "Who Benefits", href: "#who-benefits" },
  ];

  return (
    <motion.header
      className="navbar"
      initial={{ y: -30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7 }}
    >
      <div className="navbar-container">

        {/* SCHEVO BRAND */}
        <a href="#home" className="brand">
          <img
            src="/images/schevo-mark.png"
            alt=""
            className="navbar-logo"
          />

          <span className="brand-name">Schevo</span>
        </a>

        {/* DESKTOP LINKS */}
        <nav className="nav-links">
          {navLinks.map((link) => (
            <a key={link.name} href={link.href}>
              {link.name}
            </a>
          ))}
        </nav>

        {/* ACTIONS */}
        <div className="nav-actions">

          {/* THEME TOGGLE */}
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={theme}
                initial={{
                  opacity: 0,
                  rotate: -45,
                  scale: 0.7,
                }}
                animate={{
                  opacity: 1,
                  rotate: 0,
                  scale: 1,
                }}
                exit={{
                  opacity: 0,
                  rotate: 45,
                  scale: 0.7,
                }}
                transition={{ duration: 0.2 }}
              >
                {theme === "light" ? (
                  <Moon size={19} />
                ) : (
                  <Sun size={19} />
                )}
              </motion.span>
            </AnimatePresence>
          </button>

          {/* GET STARTED */}
          <Link to="/login" className="nav-cta">
            Get Started
            <ArrowUpRight size={16} />
          </Link>

          {/* MOBILE MENU BUTTON */}
          <button
            className="mobile-menu-btn"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle navigation"
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>

        </div>
      </div>

      {/* MOBILE MENU */}
      <AnimatePresence>
        {menuOpen && (
          <motion.nav
            className="mobile-menu"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                onClick={() => setMenuOpen(false)}
              >
                {link.name}
              </a>
            ))}

            <Link
              to="/login"
              onClick={() => setMenuOpen(false)}
            >
              Get Started
              <ArrowUpRight size={16} />
            </Link>
          </motion.nav>
        )}
      </AnimatePresence>

    </motion.header>
  );
};

export default Navbar;
