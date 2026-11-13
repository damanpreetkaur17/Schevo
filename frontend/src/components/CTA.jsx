
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import "./CTA.css";

const CTA = () => {
  return (
    <section className="cta-section" id="get-started">
      <motion.div
        className="cta-panel"
        initial={{ opacity: 0, y: 25 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7 }}
      >
        <div className="cta-content">

          <span className="cta-eyebrow">
            <span className="cta-dot" />
            THE NEXT STEP
          </span>

          <h2>
            Your schema.
            <br />
            <span>Your backend. Simplified.</span>
          </h2>

          <p>
            Build less boilerplate. Create more.
            Let Schevo handle the backend foundation.
          </p>

          <motion.a
            href="/signup"
            className="cta-button"
            whileHover={{ y: -5, scale: 1.035 }}
            whileTap={{ scale: 0.94, y: 1 }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 17
            }}
          >
            <span>Start Building</span>

            <span className="cta-arrow">
              <ArrowUpRight size={20} />
            </span>
          </motion.a>

          <div className="cta-bottom-text">
            BUILT FOR DEVELOPERS WHO BUILD.
          </div>

        </div>

        <span className="cta-corner top-left" />
        <span className="cta-corner top-right" />
        <span className="cta-corner bottom-left" />
        <span className="cta-corner bottom-right" />

      </motion.div>
    </section>
  );
};

export default CTA;
