
import { motion } from "framer-motion";

import {
  Database,
  Server,
  Code2,
  Globe,
  ShieldCheck,
  Zap,
} from "lucide-react";

const float = (duration, delay = 0) => ({
  y: [0, -12, 0],
  rotate: [0, 1, 0, -1, 0],
  transition: {
    duration,
    delay,
    repeat: Infinity,
    ease: "easeInOut",
  },
});

const ArchitectureVisual = () => {
  const connections = [
    {
      path: "M300 250 C220 190 170 160 105 150",
      delay: 0,
    },
    {
      path: "M300 250 C390 180 430 155 495 170",
      delay: 0.5,
    },
    {
      path: "M300 280 C230 360 175 390 105 410",
      delay: 1,
    },
    {
      path: "M300 280 C380 350 430 390 495 410",
      delay: 1.5,
    },
  ];

  return (
    <div className="architecture">

      <div className="architecture-glow" />
      <div className="architecture-orbit orbit-a" />
      <div className="architecture-orbit orbit-b" />

      {/* SVG CONNECTIONS */}
      <svg
        className="architecture-lines"
        viewBox="0 0 600 530"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="connectionGradient">
            <stop
              offset="0%"
              stopColor="#999999"
              stopOpacity="0.1"
            />
            <stop
              offset="50%"
              stopColor="#777777"
            />
            <stop
              offset="100%"
              stopColor="#B0B0B0"
              stopOpacity="0.2"
            />
          </linearGradient>
        </defs>

        {connections.map((connection, index) => (
          <g key={index}>
            <path
              d={connection.path}
              stroke="url(#connectionGradient)"
              strokeWidth="1.8"
              strokeDasharray="6 7"
              opacity="0.75"
            />

            <motion.circle
              r="4"
              fill="#777777"
              style={{
                filter: "drop-shadow(0 0 4px #888888)",
              }}
            >
              <animateMotion
                dur={`${3 + index * 0.5}s`}
                begin={`${connection.delay}s`}
                repeatCount="indefinite"
                path={connection.path}
              />
            </motion.circle>
          </g>
        ))}
      </svg>

      {/* CENTRAL DATABASE */}
      <motion.div
        className="architecture-center"
        animate={{
          y: [0, -9, 0],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <div className="database-cylinder">

          <div className="database-top">
            <div className="database-inner">
              <Database size={29} />
            </div>
          </div>

          <div className="database-body">
            <div className="database-line" />
            <div className="database-line" />
            <div className="database-line" />
          </div>

          <div className="database-bottom" />
        </div>

        <div className="database-label">
          <span className="status-dot" />
          SCHEVO ENGINE
        </div>
      </motion.div>

      {/* API NODE */}
      <motion.div
        className="architecture-node node-api"
        animate={float(5, 0.2)}
      >
        <div className="node-icon blue-icon">
          <Globe size={22} />
        </div>

        <div>
          <strong>API Layer</strong>
          <small>REST Endpoints</small>
        </div>
      </motion.div>

      {/* BACKEND NODE */}
      <motion.div
        className="architecture-node node-backend"
        animate={float(6, 0.8)}
      >
        <div className="node-icon violet-icon">
          <Server size={22} />
        </div>

        <div>
          <strong>Backend</strong>
          <small>Node + Express</small>
        </div>
      </motion.div>

      {/* MODELS NODE */}
      <motion.div
        className="architecture-node node-models"
        animate={float(5.5, 1)}
      >
        <div className="node-icon cyan-icon">
          <Code2 size={22} />
        </div>

        <div>
          <strong>Models</strong>
          <small>Structured Code</small>
        </div>
      </motion.div>

      {/* VALIDATION NODE */}
      <motion.div
        className="architecture-node node-security"
        animate={float(6, 0.5)}
      >
        <div className="node-icon green-icon">
          <ShieldCheck size={22} />
        </div>

        <div>
          <strong>Validation</strong>
          <small>Schema Rules</small>
        </div>
      </motion.div>

      {/* FLOATING LABELS */}
      <motion.div
        className="floating-tag tag-top"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 4, repeat: Infinity }}
      >
        <Zap size={13} />
        Automated Generation
      </motion.div>

      <motion.div
        className="floating-tag tag-bottom"
        animate={{ y: [0, 6, 0] }}
        transition={{ duration: 4.5, repeat: Infinity }}
      >
        <Database size={13} />
        Relational Architecture
      </motion.div>

    </div>
  );
};

export default ArchitectureVisual;
