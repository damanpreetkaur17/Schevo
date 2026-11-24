
import { motion } from "framer-motion";

import {
  ArrowUpRight,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

import ArchitectureVisual from "./ArchitectureVisual";

const Hero = () => {
  return (
    <section className="hero" id="home">

      {/* BACKGROUND */}
      <div className="hero-background-grid" />
      <div className="hero-background-glow" />

      <div className="hero-container">

        {/* LEFT CONTENT */}
        <motion.div
          className="hero-content"
          initial={{ opacity: 0, y: 35 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.8,
            ease: "easeOut",
          }}
        >

          <h1>
            Your Schema In.
            <br />
            Your Backend
            <span className="hero-highlight"> Out.</span>
          </h1>

          <motion.p
            className="hero-description"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{
              delay: 0.4,
              duration: 0.8,
            }}
          >
            Transform database schemas into structured backend
            foundations. Generate models, controllers, routes,
            API endpoints and documentation — all from one place.
          </motion.p>

          {/* BUTTONS */}
          <motion.div
            className="hero-buttons"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <a href="#get-started" className="primary-btn">
              Start Building
              <ArrowUpRight size={18} />
            </a>

            <a href="#how-it-works" className="secondary-btn">
              Explore How It Works
              <ArrowRight size={17} />
            </a>
          </motion.div>

          {/* BENEFITS */}
          <motion.div
            className="hero-benefits"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            <div>
              <CheckCircle2 size={16} />
              <span>Less Boilerplate</span>
            </div>

            <div>
              <CheckCircle2 size={16} />
              <span>Structured Backend</span>
            </div>

            <div>
              <CheckCircle2 size={16} />
              <span>Faster Development</span>
            </div>
          </motion.div>

        </motion.div>

        {/* RIGHT VISUAL */}
        <motion.div
          className="hero-visual"
          initial={{
            opacity: 0,
            scale: 0.9,
            x: 30,
          }}
          animate={{
            opacity: 1,
            scale: 1,
            x: 0,
          }}
          transition={{
            duration: 1,
            delay: 0.25,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <ArchitectureVisual />
        </motion.div>

      </div>

    </section>
  );
};

export default Hero;
