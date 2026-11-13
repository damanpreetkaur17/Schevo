
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../context/ThemeContext";
import "./../styles/Auth.css";

function Auth({ mode = "login" }) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const isLogin = mode === "login";

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [error, setError] = useState("");

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });

    setError("");
  };

  const handleModeChange = (newMode) => {
    setError("");
    setFormData({
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    });

    navigate(newMode === "login" ? "/login" : "/signup");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (!formData.email.trim() || !formData.password) {
      setError("Please fill in all required fields.");
      return;
    }

    if (!isLogin) {
      if (!formData.name.trim()) {
        setError("Please enter your full name.");
        return;
      }

      if (formData.password.length < 8) {
        setError("Password must contain at least 8 characters.");
        return;
      }

      if (formData.password !== formData.confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    // Backend API integration will be added next.
    setError("Authentication API is not connected yet.");
  };

  return (
    <div className="auth-page">
      <div className="auth-background">
        <div className="auth-glow auth-glow-one" />
        <div className="auth-glow auth-glow-two" />
        <div className="auth-grid" />
      </div>

      <header className="auth-header">
        <Link to="/" className="auth-logo">
          <span className="auth-logo-symbol">S</span>
          <span>schevo<span className="auth-logo-dot">.</span></span>
        </Link>

        <div className="auth-header-actions">
          <button
            type="button"
            className="auth-theme-toggle"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {theme === "light" ? "☾" : "☀"}
          </button>

          <Link to="/" className="auth-back-link">
            <span>←</span> Back to home
          </Link>
        </div>
      </header>

      <main className="auth-main">
        <motion.section
          className="auth-card"
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        >
          <div className="auth-card-top">
            <div className="auth-eyebrow">
              <span className="auth-status-dot" />
              YOUR BACKEND STARTS HERE
            </div>

            <h1>
              {isLogin ? (
                <>
                  Welcome <span>back.</span>
                </>
              ) : (
                <>
                  Build something <span>great.</span>
                </>
              )}
            </h1>

            <p className="auth-description">
              {isLogin
                ? "Sign in to continue building with Schevo."
                : "Create your account and turn your schemas into working backends."}
            </p>
          </div>

          <div className="auth-tabs">
            <button
              type="button"
              className={isLogin ? "active" : ""}
              onClick={() => handleModeChange("login")}
            >
              Login
            </button>

            <button
              type="button"
              className={!isLogin ? "active" : ""}
              onClick={() => handleModeChange("signup")}
            >
              Sign Up
            </button>

            <motion.div
              className="auth-tab-indicator"
              animate={{ x: isLogin ? "0%" : "100%" }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
            />
          </div>

          <AnimatePresence mode="wait">
            <motion.form
              key={mode}
              className="auth-form"
              onSubmit={handleSubmit}
              initial={{ opacity: 0, x: isLogin ? -12 : 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isLogin ? 12 : -12 }}
              transition={{ duration: 0.22 }}
            >
              {!isLogin && (
                <div className="auth-field">
                  <label htmlFor="name">Full name</label>
                  <input
                    id="name"
                    type="text"
                    name="name"
                    placeholder="Enter your full name"
                    value={formData.name}
                    onChange={handleChange}
                    autoComplete="name"
                    required
                  />
                </div>
              )}

              <div className="auth-field">
                <label htmlFor="email">Email address</label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  autoComplete="email"
                  required
                />
              </div>

              <div className="auth-field">
                <div className="auth-label-row">
                  <label htmlFor="password">Password</label>

                  {isLogin && (
                    <span className="auth-forgot">
                      Forgot password?
                    </span>
                  )}
                </div>

                <div className="auth-password-wrap">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleChange}
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    required
                  />

                  <button
                    type="button"
                    className="auth-password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {!isLogin && (
                <div className="auth-field">
                  <label htmlFor="confirmPassword">
                    Confirm password
                  </label>

                  <div className="auth-password-wrap">
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      placeholder="Re-enter your password"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      autoComplete="new-password"
                      required
                    />

                    <button
                      type="button"
                      className="auth-password-toggle"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                    >
                      {showConfirmPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className="auth-error" role="alert">
                  {error}
                </div>
              )}

              <button type="submit" className="auth-submit">
                <span>{isLogin ? "Sign In" : "Create Account"}</span>
                <span className="auth-submit-arrow">↗</span>
              </button>
            </motion.form>
          </AnimatePresence>

          <div className="auth-switch">
            {isLogin ? "Don't have an account?" : "Already have an account?"}

            <button
              type="button"
              onClick={() => handleModeChange(isLogin ? "signup" : "login")}
            >
              {isLogin ? "Create one" : "Sign in"}
            </button>
          </div>

          <div className="auth-card-footer">
            <span>SCHEMA IN. BACKEND OUT.</span>
            <span>SCHEVO © 2026</span>
          </div>
        </motion.section>

        <p className="auth-bottom-text">
          BUILT FOR DEVELOPERS WHO BUILD.
        </p>
      </main>
    </div>
  );
}

export default Auth;
