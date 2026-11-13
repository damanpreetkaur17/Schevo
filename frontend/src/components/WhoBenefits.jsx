
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import {
  Code2,
  GraduationCap,
  Rocket,
  ArrowUpRight,
  Check,
  Database,
  Layers3,
  Workflow,
  Zap,
} from "lucide-react";

import "./WhoBenefits.css";

const audiences = [
  {
    id: "developers",
    number: "01",
    label: "Backend Developers",
    short: "For developers",
    icon: Code2,
    heading: "Spend less time on boilerplate. More time building.",
    description:
      "Skip repetitive backend setup and turn database schemas into organized backend foundations.",
    challenges: [
      "Repetitive model and controller creation",
      "Manual API route configuration",
      "Keeping backend structures consistent",
    ],
    benefits: [
      "Structured model generation",
      "Organized controllers and routes",
      "Ready-to-use API endpoints",
    ],
    workflow: [
      { icon: Database, label: "Define schema" },
      { icon: Workflow, label: "Generate backend" },
      { icon: Code2, label: "Get API endpoints" },
    ],
    tag: "BUILD FASTER",
  },
  {
    id: "students",
    number: "02",
    label: "Students & Learners",
    short: "For learners",
    icon: GraduationCap,
    heading: "Understand backend development by building it.",
    description:
      "Explore how database schemas translate into models, controllers, routes and APIs through a structured workflow.",
    challenges: [
      "Understanding backend architecture",
      "Connecting database tables and relationships",
      "Learning how APIs are structured",
    ],
    benefits: [
      "Visualize database structures",
      "Explore generated backend files",
      "Learn through practical examples",
    ],
    workflow: [
      { icon: Database, label: "Explore schema" },
      { icon: Layers3, label: "Understand structure" },
      { icon: Code2, label: "Explore generated code" },
    ],
    tag: "LEARN BY BUILDING",
  },
  {
    id: "startups",
    number: "03",
    label: "Startups & Teams",
    short: "For teams",
    icon: Rocket,
    heading: "Move from database design to development faster.",
    description:
      "Create a structured starting point for backend development and spend more time on the product your team is building.",
    challenges: [
      "Setting up backend foundations",
      "Managing repetitive development work",
      "Maintaining consistent project structures",
    ],
    benefits: [
      "Faster backend scaffolding",
      "Consistent project organization",
      "Documented API foundations",
    ],
    workflow: [
      { icon: Database, label: "Design data" },
      { icon: Zap, label: "Generate structure" },
      { icon: Workflow, label: "Start development" },
    ],
    tag: "ACCELERATE DEVELOPMENT",
  },
];

const WhoBenefits = () => {
  const [activeAudience, setActiveAudience] = useState("developers");

  const active = audiences.find(
    (audience) => audience.id === activeAudience
  );

  return (
    <section className="benefits-section" id="who-benefits">
      <div className="benefits-container">
        <div className="benefits-section-heading">
            <span>WHO IS IT FOR?</span>
            <div className="benefits-heading-line" />
        </div>

        {/* INTERACTIVE EXPLORER */}
        <div className="benefits-explorer">

          {/* LEFT: AUDIENCE SELECTOR */}
          <div className="benefits-selector">
            <div className="audience-options">
              {audiences.map((audience) => {
                const Icon = audience.icon;
                const isActive =
                  activeAudience === audience.id;

                return (
                  <button
                    key={audience.id}
                    className={`audience-option ${
                      isActive ? "active" : ""
                    }`}
                    onClick={() =>
                      setActiveAudience(audience.id)
                    }
                    aria-pressed={isActive}
                  >
                    <span className="audience-option-number">
                      {audience.number}
                    </span>

                    <Icon size={19} strokeWidth={1.7} />

                    <span className="audience-option-label">
                      {audience.label}
                    </span>

                    <ArrowUpRight
                      className="audience-option-arrow"
                      size={17}
                    />
                  </button>
                );
              })}
            </div>

            <div className="benefits-selector-note">
              <span className="selector-dot" />
              SELECT YOUR ROLE TO EXPLORE
            </div>

          </div>


          {/* RIGHT: DYNAMIC CONTENT */}
          <div className="benefits-content">

            <AnimatePresence mode="wait">
              <motion.div
                key={active.id}
                className="benefits-content-inner"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35 }}
              >

                <div className="benefits-content-top">
                  <span className="benefits-content-tag">
                    {active.tag}
                  </span>

                  <span className="benefits-content-number">
                    {active.number} / 03
                  </span>
                </div>


                {/* MAIN HEADING */}
                <h3>{active.heading}</h3>

                <p className="benefits-description">
                  {active.description}
                </p>


                {/* CHALLENGES AND BENEFITS */}
                <div className="benefits-comparison">

                  <div className="benefits-list">
                    <span className="benefits-list-heading">
                      THE CHALLENGE
                    </span>

                    {active.challenges.map((item) => (
                      <div
                        className="benefits-list-item challenge-item"
                        key={item}
                      >
                        <span className="challenge-dash">
                          —
                        </span>
                        {item}
                      </div>
                    ))}
                  </div>

                  <div className="benefits-list">
                    <span className="benefits-list-heading">
                      WHAT SCHEVO OFFERS
                    </span>

                    {active.benefits.map((item) => (
                      <div
                        className="benefits-list-item"
                        key={item}
                      >
                        <span className="benefit-check">
                          <Check size={12} />
                        </span>
                        {item}
                      </div>
                    ))}
                  </div>

                </div>


                {/* MINI WORKFLOW */}
                <div className="benefits-mini-workflow">

                  <span className="workflow-label">
                    THE WORKFLOW
                  </span>

                  <div className="workflow-items">
                    {active.workflow.map((step, index) => {
                      const Icon = step.icon;

                      return (
                        <div
                          className="workflow-item"
                          key={step.label}
                        >
                          <div className="workflow-icon">
                            <Icon size={17} />
                          </div>

                          <span>{step.label}</span>

                          {index !==
                            active.workflow.length - 1 && (
                            <div className="workflow-connector">
                              <ArrowUpRight size={14} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                </div>

              </motion.div>
            </AnimatePresence>

          </div>

        </div>


      </div>
    </section>
  );
};

export default WhoBenefits;
