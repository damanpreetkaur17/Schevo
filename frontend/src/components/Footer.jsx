
import { ArrowUpRight } from "lucide-react";
import "./Footer.css";

const Footer = () => {
  return (
    <footer className="footer-section">
      <div className="footer-container">

        {/* TOP SECTION */}

        <div className="footer-top">

          <div className="footer-brand">
            <a href="#top" className="footer-logo">
              Schevo<span>.</span>
            </a>

            <p>
              From database schemas to structured backends.
              Build smarter with Schevo.
            </p>
          </div>

          {/* NAVIGATION */}

          <div className="footer-links">

            <div className="footer-column">
              <h4>EXPLORE</h4>

              <a href="#how-it-works">
                How It Works
              </a>

              <a href="#features">
                Features
              </a>

              <a href="#who-benefits">
                Who Benefits
              </a>
            </div>

            <div className="footer-column">
              <h4>GET STARTED</h4>

              <a href="/signup">
                Create Account
                <ArrowUpRight size={13} />
              </a>

              <a href="/login">
                Sign In
              </a>
            </div>

            <div className="footer-column">
              <h4>CONNECT</h4>

              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
              >
                GitHub
                <ArrowUpRight size={13} />
              </a>

              <a href="mailto:contact@schevo.dev">
                Contact Us
              </a>
            </div>

          </div>
        </div>

        {/* BOTTOM SECTION */}

        <div className="footer-bottom">

          <p>
            © {new Date().getFullYear()} Schevo.
            All rights reserved.
          </p>

          <p className="footer-tagline">
            BUILT FOR DEVELOPERS WHO BUILD.
          </p>

          <a href="#top" className="back-to-top">
            BACK TO TOP
            <ArrowUpRight size={15} />
          </a>

        </div>

      </div>
    </footer>
  );
};

export default Footer;
