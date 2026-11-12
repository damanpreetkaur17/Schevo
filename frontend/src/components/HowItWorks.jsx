
import { motion } from "framer-motion";

import {
  Database,
  Workflow,
  Code2,
  Download,
  ArrowRight,
  Check,
} from "lucide-react";

import "./HowItWorks.css";

const steps = [
  {
    number: "01",
    title: "Define Your Schema",
    description:
      "Start by defining your database structure. Add tables, fields, data types and relationships to describe how your data is organized.",
    icon: Database,
    label: "INPUT",
    details: [
      "Define database tables",
      "Add columns and data types",
      "Establish relationships",
    ],
  },
  {
    number: "02",
    title: "Process Your Schema",
    description:
      "Schevo analyzes your schema, understands the relationships and validates the structure before generating your backend.",
    icon: Workflow,
    label: "PROCESSING",
    details: [
      "Parse schema definitions",
      "Identify relationships",
      "Validate structure",
    ],
  },
  {
    number: "03",
    title: "Generate Backend",
    description:
      "Turn your schema into an organized backend foundation with models, controllers, routes, API endpoints and documentation.",
    icon: Code2,
    label: "GENERATION",
    details: [
      "Generate models",
      "Create controllers and routes",
      "Generate API documentation",
    ],
  },
  {
    number: "04",
    title: "Review & Download",
    description:
      "Explore your generated project structure, review the files and download your backend foundation to continue development.",
    icon: Download,
    label: "OUTPUT",
    details: [
      "Review generated files",
      "Inspect backend structure",
      "Download your project",
    ],
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.18,
    },
  },
};

const cardVariants = {
  hidden: {
    opacity: 0,
    y: 35,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.65,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

const HowItWorks = () => {
  return (
    <section className="how-section" id="how-it-works">

      {/* BACKGROUND DETAILS */}
      <div className="how-background-glow" />
      <div className="how-grid-pattern" />

      <div className="how-container">

        {/* SECTION HEADER */}
        <motion.div
          className="how-header"
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7 }}
        >
          <div className="how-eyebrow">
            <span className="how-eyebrow-dot" />
            THE WORKFLOW
          </div>

          <h2>
            From Schema to Backend.
            <br />
            <span>Four Simple Steps.</span>
          </h2>

          <p>
            What usually takes hours of repetitive setup
            can start with a single structured schema.
            Let Schevo handle the foundation.
          </p>
        </motion.div>

        {/* WORKFLOW CARDS */}
        <motion.div
          className="how-steps"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
        >

          {steps.map((step, index) => {
            const Icon = step.icon;

            return (
              <motion.div
                className="how-step-wrapper"
                key={step.number}
                variants={cardVariants}
              >

                <motion.article
                  className="how-card"
                  whileHover={{
                    y: -8,
                    transition: { duration: 0.25 },
                  }}
                >

                  {/* CARD TOP */}
                  <div className="how-card-top">
                    <span className="how-step-number">
                      {step.number}
                    </span>

                    <span className="how-step-label">
                      {step.label}
                    </span>
                  </div>

                  {/* ICON */}
                  <div className="how-icon-box">
                    <Icon size={27} strokeWidth={1.7} />
                  </div>

                  {/* CONTENT */}
                  <h3>{step.title}</h3>

                  <p className="how-card-description">
                    {step.description}
                  </p>

                  {/* FEATURES */}
                  <div className="how-card-details">
                    {step.details.map((detail) => (
                      <div
                        className="how-detail"
                        key={detail}
                      >
                        <span className="how-check">
                          <Check size={12} />
                        </span>

                        <span>{detail}</span>
                      </div>
                    ))}
                  </div>

                  {/* BOTTOM */}
                  <div className="how-card-bottom">
                    <span>STEP {step.number}</span>

                    {index !== steps.length - 1 && (
                      <ArrowRight size={17} />
                    )}
                  </div>

                </motion.article>

                {/* CONNECTOR */}
                {index !== steps.length - 1 && (
                  <div className="how-connector">
                    <motion.div
                      className="how-connector-line"
                      initial={{ scaleX: 0 }}
                      whileInView={{ scaleX: 1 }}
                      viewport={{ once: true }}
                      transition={{
                        duration: 0.8,
                        delay: 0.3 + index * 0.15,
                      }}
                    />

                    <span className="how-connector-dot" />
                  </div>
                )}

              </motion.div>
            );
          })}

        </motion.div>

        {/* BOTTOM STATEMENT */}
        <motion.div
          className="how-bottom"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >

        </motion.div>

      </div>
    </section>
  );
};

export default HowItWorks;
