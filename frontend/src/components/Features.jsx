
import { motion } from "framer-motion";

import {
  Database,
  Code2,
  Network,
  ShieldCheck,
  FileJson,
  Workflow,
  ArrowUpRight,
  Check,
  CircleDot,
  Table2,
  Braces,
  FileCode2,
} from "lucide-react";

import "./Features.css";

const coreFeatures = [
  {
    number: "01",
    category: "SCHEMA DESIGNER",
    title: "Define your database structure.",
    description:
      "Create and organize database tables, fields, data types and relationships in one structured workspace.",
    icon: Database,
    preview: "schema",
  },
  {
    number: "02",
    category: "BACKEND GENERATION",
    title: "From schema to backend code.",
    description:
      "Generate organized models, controllers and routes from your defined database structure.",
    icon: Code2,
    preview: "backend",
  },
  {
    number: "03",
    category: "API GENERATION",
    title: "Your endpoints, structured.",
    description:
      "Generate REST API endpoints for your database resources with organized routing and request handling.",
    icon: Workflow,
    preview: "api",
  },
];

const moreFeatures = [
  {
    number: "04",
    category: "RELATIONSHIP MAPPING",
    title: "Connect your data logically.",
    description:
      "Visualize how your database tables connect through primary keys and foreign key relationships.",
    icon: Network,
    preview: "relations",
  },
  {
    number: "05",
    category: "SCHEMA VALIDATION",
    title: "Catch structural issues early.",
    description:
      "Validate schema definitions, field configurations and relationships before code generation.",
    icon: ShieldCheck,
    preview: "validation",
  },
  {
    number: "06",
    category: "DOCUMENTATION & EXPORT",
    title: "Everything, ready to take away.",
    description:
      "Review your generated project files and API documentation, then export your backend foundation.",
    icon: FileJson,
    preview: "export",
  },
];


/* =========================================
   MINIATURE PRODUCT PREVIEWS
========================================= */

const SchemaPreview = () => (
  <div className="feature-window">
    <div className="preview-toolbar">
      <div className="preview-dots">
        <i />
        <i />
        <i />
      </div>
      <span>schema.editor</span>
      <span className="preview-toolbar-action">+ Table</span>
    </div>

    <div className="schema-preview-content">
      <div className="schema-table">
        <div className="schema-table-heading">
          <Database size={12} />
          <strong>Users</strong>
          <span>3 FIELDS</span>
        </div>

        {[
          ["id", "INTEGER", "PK"],
          ["name", "VARCHAR", ""],
          ["email", "VARCHAR", "UNIQUE"],
        ].map((field) => (
          <div className="schema-field" key={field[0]}>
            <span>{field[0]}</span>
            <small>{field[1]}</small>
            {field[2] && <em>{field[2]}</em>}
          </div>
        ))}
      </div>

      <div className="schema-table">
        <div className="schema-table-heading">
          <Database size={12} />
          <strong>Orders</strong>
          <span>3 FIELDS</span>
        </div>

        {[
          ["order_id", "INTEGER", "PK"],
          ["user_id", "INTEGER", "FK"],
          ["amount", "DECIMAL", ""],
        ].map((field) => (
          <div className="schema-field" key={field[0]}>
            <span>{field[0]}</span>
            <small>{field[1]}</small>
            {field[2] && <em>{field[2]}</em>}
          </div>
        ))}
      </div>
    </div>

    <div className="preview-status">
      <CircleDot size={11} />
      2 tables defined
      <span>READY</span>
    </div>
  </div>
);


const BackendPreview = () => (
  <div className="feature-window">
    <div className="preview-toolbar">
      <div className="preview-dots">
        <i />
        <i />
        <i />
      </div>
      <span>generated-project</span>
      <span className="preview-toolbar-action">src/</span>
    </div>

    <div className="backend-preview-content">
      <div className="file-tree">
        <div className="file-tree-title">
          <Code2 size={12} />
          PROJECT FILES
        </div>

        {[
          ["models/", "folder"],
          ["user.model.js", "file"],
          ["controllers/", "folder"],
          ["user.controller.js", "file"],
          ["routes/", "folder"],
          ["user.routes.js", "file"],
          ["validation/", "folder"],
          ["user.validation.js", "file"],
          ["api-docs.json", "file"],
        ].map(([name, type], index) => (
          <div
            className={`file-tree-row ${index === 1 ? "selected" : ""}`}
            key={name}
          >
            {type === "folder" ? (
              <Database size={12} />
            ) : (
              <FileCode2 size={12} />
            )}
            <span>{name}</span>
          </div>
        ))}
      </div>

      <div className="code-preview">
        <div className="code-preview-title">
          user.model.js
        </div>

        <div className="code-lines">
          <div><span>01</span> <b>const</b> User = {`{`}</div>
          <div><span>02</span> &nbsp; id: <i>Integer</i>,</div>
          <div><span>03</span> &nbsp; name: <i>String</i>,</div>
          <div><span>04</span> &nbsp; email: <i>String</i></div>
          <div><span>05</span> {`};`}</div>
        </div>

        <div className="code-complete">
          <Check size={11} />
          File generated
        </div>
      </div>
    </div>
  </div>
);


const ApiPreview = () => (
  <div className="feature-window">
    <div className="preview-toolbar">
      <div className="preview-dots">
        <i />
        <i />
        <i />
      </div>
      <span>api.explorer</span>
      <span className="preview-toolbar-action">REST</span>
    </div>

    <div className="api-preview-content">
      <div className="api-endpoint">
        <span className="method get">GET</span>
        <code>/api/users</code>
        <span className="endpoint-check"><Check size={12}/></span>
      </div>

      <div className="api-endpoint">
        <span className="method post">POST</span>
        <code>/api/users</code>
        <span className="endpoint-check"><Check size={12}/></span>
      </div>

      <div className="api-endpoint">
        <span className="method put">PUT</span>
        <code>/api/users/:id</code>
        <span className="endpoint-check"><Check size={12}/></span>
      </div>

      <div className="api-endpoint">
        <span className="method delete">DELETE</span>
        <code>/api/users/:id</code>
        <span className="endpoint-check"><Check size={12}/></span>
      </div>

      <div className="api-response">
        <div className="api-response-header">
          RESPONSE PREVIEW
          <span>200 OK</span>
        </div>

        <pre>{`{
  "success": true,
  "data": [...]
}`}</pre>
      </div>
    </div>
  </div>
);


const RelationsPreview = () => (
  <div className="feature-window">
    <div className="preview-toolbar">
      <div className="preview-dots">
        <i />
        <i />
        <i />
      </div>
      <span>relationship.map</span>
      <span className="preview-toolbar-action">ERD</span>
    </div>

    <div className="relations-preview-content">
      <svg
        className="relation-lines"
        viewBox="0 0 360 160"
        preserveAspectRatio="none"
      >
        <path d="M120 68 H160 V68 H205" />
        <path d="M260 91 V118 H180 V132" />
        <circle cx="160" cy="68" r="3" />
        <circle cx="180" cy="118" r="3" />
      </svg>

      <div className="relation-node relation-user">
        <div><Database size={12}/> Users</div>
        <small>id · PK</small>
        <small>name</small>
      </div>

      <div className="relation-node relation-orders">
        <div><Table2 size={12}/> Orders</div>
        <small>order_id · PK</small>
        <small>user_id · FK</small>
      </div>

      <div className="relation-node relation-products">
        <div><Table2 size={12}/> Products</div>
        <small>product_id · PK</small>
        <small>order_id · FK</small>
      </div>
    </div>
  </div>
);


const ValidationPreview = () => (
  <div className="feature-window">
    <div className="preview-toolbar">
      <div className="preview-dots">
        <i />
        <i />
        <i />
      </div>
      <span>schema.validation</span>
      <span className="preview-toolbar-action">CHECK</span>
    </div>

    <div className="validation-preview-content">
      <div className="validation-summary">
        <div>
          <strong>04</strong>
          <small>CHECKS PASSED</small>
        </div>

        <div className="validation-success">
          <ShieldCheck size={24}/>
        </div>
      </div>

      {[
        "Table definitions",
        "Field data types",
        "Primary keys",
        "Foreign key references",
      ].map((item) => (
        <div className="validation-row" key={item}>
          <span>{item}</span>
          <span className="validation-pass">
            <Check size={12}/>
            Passed
          </span>
        </div>
      ))}

      <div className="validation-footer">
        <CircleDot size={10}/>
        Validation completed
      </div>
    </div>
  </div>
);


const ExportPreview = () => (
  <div className="feature-window">
    <div className="preview-toolbar">
      <div className="preview-dots">
        <i />
        <i />
        <i />
      </div>
      <span>project.export</span>
      <span className="preview-toolbar-action">FILES</span>
    </div>

    <div className="export-preview-content">
      <div className="export-file">
        <div className="export-file-icon">
          <FileCode2 size={15}/>
        </div>
        <div>
          <strong>user.model.js</strong>
          <small>Generated model</small>
        </div>
        <Check size={14}/>
      </div>

      <div className="export-file">
        <div className="export-file-icon">
          <Braces size={15}/>
        </div>
        <div>
          <strong>user.routes.js</strong>
          <small>API routes</small>
        </div>
        <Check size={14}/>
      </div>

      <div className="export-file">
        <div className="export-file-icon">
          <FileJson size={15}/>
        </div>
        <div>
          <strong>api-docs.json</strong>
          <small>Documentation</small>
        </div>
        <Check size={14}/>
      </div>

      <div className="export-ready">
        <Check size={13}/>
        Project structure ready for export
      </div>
    </div>
  </div>
);


const previews = {
  schema: SchemaPreview,
  backend: BackendPreview,
  api: ApiPreview,
  relations: RelationsPreview,
  validation: ValidationPreview,
  export: ExportPreview,
};


/* =========================================
   FEATURE CARD
========================================= */

const FeatureCard = ({ feature, index }) => {
  const Icon = feature.icon;
  const Preview = previews[feature.preview];

  return (
    <motion.article
      className="feature-card"
      initial={{ opacity: 0, y: 35 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{
        duration: 0.6,
        delay: (index % 3) * 0.12,
      }}
      whileHover={{
        y: -5,
        transition: { duration: 0.25 },
      }}
    >
      <div className="feature-card-heading">
        <span className="feature-category">
          {feature.category}
        </span>

        <Icon size={18} strokeWidth={1.7}/>
      </div>

      <div className="feature-preview">
        <Preview />
      </div>

      <div className="feature-card-footer">
        <div className="feature-card-copy">
          <h3>{feature.title}</h3>
          <p>{feature.description}</p>
        </div>

        <a
          href="#get-started"
          className="feature-arrow"
          aria-label={`Explore ${feature.title}`}
        >
          <ArrowUpRight size={19}/>
        </a>
      </div>
    </motion.article>
  );
};


/* =========================================
   MAIN FEATURES SECTION
========================================= */

const Features = () => {
  return (
    <section className="features-section" id="features">
      <div className="features-container">

        {/* CORE FEATURES */}
        <div className="features-group">
          <div className="features-group-heading">
            <div>
              <span className="features-group-label">
                CORE CAPABILITIES
              </span>

              <h3>Build Your Backend</h3>
            </div>

            <span className="features-count">01 — 03</span>
          </div>

          <div className="features-grid core-grid">
            {coreFeatures.map((feature, index) => (
              <FeatureCard
                key={feature.number}
                feature={feature}
                index={index}
              />
            ))}
          </div>
        </div>


        {/* MORE FEATURES */}
        <div className="features-group more-features-group">
          <div className="features-group-heading">
            <div>
              <span className="features-group-label">
                MORE CAPABILITIES
              </span>

              <h3>More Features</h3>
            </div>

            <span className="features-count">04 — 06</span>
          </div>

          <div className="features-grid more-grid">
            {moreFeatures.map((feature, index) => (
              <FeatureCard
                key={feature.number}
                feature={feature}
                index={index + 3}
              />
            ))}
          </div>
        </div>

      </div>
    </section>
  );
};

export default Features;
