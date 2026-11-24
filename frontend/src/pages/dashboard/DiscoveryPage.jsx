import { useState } from "react";
import {
  BookOpen, ChevronDown, Copy, Download, FileText,
  Play, Search, ShieldCheck, Terminal, Workflow,
} from "lucide-react";
import { PageHeader } from "../../components/dashboard/DashboardPrimitives";
import { apiRequestDetailed } from "../../services/apiClient";
import { schemaRepository, schemaToSql } from "../../services/schemaRepository";

const METHODS = ["GET", "POST", "PATCH", "DELETE"];

const ROUTES = [
  { id: "health", group: "System", method: "GET", path: "/health", title: "Health check", description: "Confirm that the Schevo API is reachable.", auth: false, body: "" },
  { id: "signup", group: "Authentication", method: "POST", path: "/auth/signup", title: "Create an account", description: "Register a user and establish a server-side session.", auth: false, body: JSON.stringify({ displayName: "Ada Lovelace", email: "ada@example.com", password: "Example123" }, null, 2) },
  { id: "login", group: "Authentication", method: "POST", path: "/auth/login", title: "Sign in", description: "Authenticate with email and password.", auth: false, body: JSON.stringify({ email: "ada@example.com", password: "Example123" }, null, 2) },
  { id: "me", group: "Authentication", method: "GET", path: "/auth/me", title: "Current session", description: "Restore the authenticated user and workspace.", auth: true, body: "" },
  { id: "logout", group: "Authentication", method: "POST", path: "/auth/logout", title: "Sign out", description: "Revoke the current server-side session.", auth: true, body: "" },
  { id: "profile", group: "Authentication", method: "PATCH", path: "/auth/profile", title: "Update profile", description: "Change the authenticated user's display name.", auth: true, body: JSON.stringify({ displayName: "Ada Lovelace" }, null, 2) },
  { id: "password", group: "Authentication", method: "POST", path: "/auth/password", title: "Change password", description: "Rotate the password and revoke existing sessions.", auth: true, body: JSON.stringify({ currentPassword: "Example123", nextPassword: "NewExample123" }, null, 2) },
  { id: "projects-list", group: "Projects", method: "GET", path: "/projects", title: "List projects", description: "List projects owned by the current workspace user.", auth: true, body: "" },
  { id: "projects-create", group: "Projects", method: "POST", path: "/projects", title: "Create project", description: "Create a PostgreSQL schema project.", auth: true, body: JSON.stringify({ name: "Commerce API", description: "A new project" }, null, 2) },
  { id: "project-read", group: "Projects", method: "GET", path: "/projects/:projectId", title: "Read project", description: "Read one owned project and its schema document.", auth: true, body: "" },
  { id: "project-update", group: "Projects", method: "PATCH", path: "/projects/:projectId", title: "Update project", description: "Save project metadata or a versioned schema document.", auth: true, body: JSON.stringify({ name: "Commerce API", description: "Updated description", version: 1 }, null, 2) },
  { id: "project-delete", group: "Projects", method: "DELETE", path: "/projects/:projectId", title: "Delete project", description: "Permanently delete an owned project.", auth: true, destructive: true, body: "" },
  { id: "project-versions", group: "Projects", method: "GET", path: "/projects/:projectId/versions", title: "Schema versions", description: "Read saved schema snapshots for a project.", auth: true, body: "" },
  { id: "activity", group: "Activity", method: "GET", path: "/activity", title: "Activity events", description: "Read the latest recorded project and schema events.", auth: true, body: "" },
];

const DOC_SECTIONS = [
  ["introduction", "Introduction"],
  ["getting-started", "Getting started"],
  ["dashboard", "Dashboard"],
  ["projects", "Project management"],
  ["designer", "Schema designer"],
  ["tables", "Tables and columns"],
  ["relationships", "Relationships"],
  ["constraints", "Constraints and indexes"],
  ["sql", "SQL preview"],
  ["integration", "API integration"],
  ["troubleshooting", "Troubleshooting and FAQ"],
];

function routeUrl(route, projectId) {
  return `/api/v1${route.path.replace(":projectId", projectId || ":projectId")}`;
}

function exampleResponse(route) {
  if (route.id === "health") return { ok: true };
  if (route.id === "me") return { user: { id: "uuid", email: "user@example.com", displayName: "Ada Lovelace" }, workspace: { id: "uuid", name: "Ada's workspace" } };
  if (route.group === "Projects") return { project: { id: "uuid", name: "Commerce API", tableCount: 0, relationshipCount: 0 } };
  if (route.id === "activity") return { events: [{ id: "uuid", kind: "project.created", message: "Created project." }] };
  return { ok: true };
}

function buildOpenApiSpec() {
  const paths = {};
  ROUTES.forEach((route) => {
    const path = `/api/v1${route.path}`;
    paths[path] = paths[path] || {};
    paths[path][route.method.toLowerCase()] = {
      summary: route.title,
      description: route.description,
      security: route.auth ? [{ sessionCookie: [], csrfHeader: [] }] : [],
      requestBody: route.body ? { required: true, content: { "application/json": { schema: { type: "object" }, example: JSON.parse(route.body) } } } : undefined,
      responses: {
        200: { description: "Successful response" },
        ...(route.method === "POST" ? { 201: { description: "Created or authenticated" } } : {}),
        400: { description: "Invalid request" },
        401: { description: "Authentication required or credentials rejected" },
        403: { description: "CSRF token is missing or invalid" },
        ...(route.method === "DELETE" ? { 404: { description: "Project not found" } } : {}),
      },
    };
  });
  return {
    openapi: "3.0.3",
    info: { title: "Schevo API", version: "1.0.0", description: "Generated from the routes currently implemented by Schevo's Express server." },
    servers: [{ url: "/api/v1" }],
    components: { securitySchemes: { sessionCookie: { type: "apiKey", in: "cookie", name: "schevo.sid" }, csrfHeader: { type: "apiKey", in: "header", name: "x-csrf-token" } } },
    paths,
  };
}

function downloadText(filename, content, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function projectMarkdown(project) {
  if (!project) return "# Schevo documentation\n\nNo project is selected.";
  const tables = project.schema.tables.map((table) => `### ${table.name}\n\n${table.columns.map((column) => `- \`${column.name}\` — ${column.type}${column.nullable === false ? ", required" : ""}${column.defaultExpression ? `, default \`${column.defaultExpression}\`` : ""}`).join("\n") || "- No columns defined"}`).join("\n\n");
  return `# ${project.name}\n\n${project.description || "Schevo schema project"}\n\n## Schema\n\nTables: ${project.schema.tables.length}\nRelationships: ${project.schema.relationships.length}\n\n${tables}\n\n## SQL preview\n\n\`\`\`sql\n${schemaToSql(project.schema) || "-- No SQL yet"}\n\`\`\`\n`;
}

function CodeSample({ label, code }) {
  return <details open={label === "cURL example"}>
    <summary><Terminal size={13} /> {label}<button className="secondary-button compact" type="button" onClick={(event) => { event.preventDefault(); navigator.clipboard.writeText(code); }}><Copy size={12} /> Copy</button></summary>
    <pre>{code}</pre>
  </details>;
}

function ApiEndpointDetail({ route, projectId, onRun }) {
  const url = routeUrl(route, projectId);
  const curl = `curl -X ${route.method} "${url}"${route.body ? ` \\\n  -H "Content-Type: application/json" \\\n  -d '${route.body.replaceAll("'", "\\'")}'` : ""}`;
  const fetchExample = `fetch("${url}", { method: "${route.method}", credentials: "include"${route.body ? `, headers: { "Content-Type": "application/json" }, body: JSON.stringify(${route.body})` : ""} })`;
  return <article className="api-endpoint-doc">
    <header><div><span className={`method-chip method-${route.method.toLowerCase()}`}>{route.method}</span><h2>{url}</h2></div><span className={route.auth ? "auth-badge" : "public-badge"}>{route.auth ? <><ShieldCheck size={12} /> Session required</> : "Public"}</span></header>
    <p>{route.description}</p>
    <div className="api-doc-grid"><div><strong>When to use</strong><p>{route.title}. Requests use the existing Schevo session and CSRF protections.</p></div><div><strong>Request headers</strong><pre>{route.method === "GET" ? "Accept: application/json" : "Content-Type: application/json\nx-csrf-token: browser-managed"}</pre></div><div><strong>Request body</strong><pre>{route.body || "No request body."}</pre></div><div><strong>Response example</strong><pre>{JSON.stringify(exampleResponse(route), null, 2)}</pre></div></div>
    <div className="api-status-row"><span><strong>Success:</strong> {route.method === "POST" ? "201 Created or 200 OK" : "200 OK"}</span><span><strong>Errors:</strong> 400 validation · 401 authentication · 403 CSRF · 404 missing resource</span></div>
    <div className="api-code-samples"><CodeSample label="cURL example" code={curl} /><CodeSample label="JavaScript fetch" code={fetchExample} /></div>
    <button className="primary-button compact" type="button" onClick={() => onRun(route)}><Play size={13} /> Open request console</button>
  </article>;
}

function RequestConsole({ route, projectId, onClose }) {
  const [path, setPath] = useState(routeUrl(route, projectId));
  const [body, setBody] = useState(route.body || "");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const send = async () => {
    if (route.destructive && !window.confirm("This request permanently deletes data. Continue?")) return;
    let parsed;
    if (body.trim()) {
      try { parsed = JSON.parse(body); } catch { setError("Request body must be valid JSON."); return; }
    }
    setBusy(true); setError(""); setResult(null);
    try { setResult(await apiRequestDetailed(path, { method: route.method, body: parsed })); } catch (requestError) { setError(requestError.message); setResult(requestError.result || null); } finally { setBusy(false); }
  };
  return <aside className="api-console"><header><div><span className="dashboard-eyebrow">Request console</span><strong>{route.method} {route.path}</strong></div><button className="icon-button" type="button" aria-label="Close request console" onClick={onClose}>×</button></header><label>Environment<select><option>Local development · http://localhost:5173</option></select></label><label>URL<input value={path} onChange={(event) => setPath(event.target.value)} /></label><p className="console-auth"><ShieldCheck size={14} /> Browser session and CSRF handling are automatic.</p>{route.method !== "GET" && <label>JSON body<textarea rows="9" value={body} onChange={(event) => setBody(event.target.value)} /></label>}<div className="console-actions"><button className="primary-button compact" type="button" disabled={busy} onClick={send}>{busy ? "Sending…" : "Send request"} <Play size={13} /></button><button className="secondary-button compact" type="button" onClick={() => { setPath(routeUrl(route, projectId)); setBody(route.body || ""); setResult(null); setError(""); }}>Reset</button></div>{error && <p className="field-error" role="alert">{error}</p>}{result && <div className="console-result"><strong>{result.status} · {result.duration}ms</strong><small>Response headers</small><pre>{JSON.stringify(result.headers, null, 2)}</pre><small>Response body</small><pre>{JSON.stringify(result.data, null, 2)}</pre><button className="secondary-button compact" type="button" onClick={() => navigator.clipboard.writeText(JSON.stringify(result.data, null, 2))}><Copy size={12} /> Copy response</button></div>}</aside>;
}

function ApiExplorer() {
  const projects = schemaRepository.list();
  const [query, setQuery] = useState("");
  const [method, setMethod] = useState("ALL");
  const [selectedId, setSelectedId] = useState(ROUTES[0].id);
  const [consoleRoute, setConsoleRoute] = useState(null);
  const projectId = projects[0]?.id;
  const filtered = ROUTES.filter((route) => (method === "ALL" || route.method === method) && `${route.title} ${route.path} ${route.group}`.toLowerCase().includes(query.toLowerCase()));
  const selected = ROUTES.find((route) => route.id === selectedId) || filtered[0] || ROUTES[0];
  const groups = [...new Set(filtered.map((route) => route.group))];
  return <section className="developer-page"><PageHeader eyebrow="Developer tools" title="API Explorer" description="Inspect the routes actually implemented by the Schevo Express server and test safe requests locally." /><div className="api-workspace"><aside className="api-route-nav"><label className="dashboard-search-input"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search endpoints" /></label><div className="method-filters"><button className={method === "ALL" ? "is-active" : ""} type="button" onClick={() => setMethod("ALL")}>All</button>{METHODS.map((item) => <button className={method === item ? "is-active" : ""} type="button" key={item} onClick={() => setMethod(item)}>{item}</button>)}</div>{groups.map((group) => <details open key={group}><summary>{group}<ChevronDown size={13} /></summary>{filtered.filter((route) => route.group === group).map((route) => <button className={selected.id === route.id ? "is-active" : ""} type="button" key={route.id} onClick={() => setSelectedId(route.id)}><b className={`method-chip method-${route.method.toLowerCase()}`}>{route.method}</b><span>{route.title}<small>{route.path}</small></span>{route.auth && <ShieldCheck size={12} />}</button>)}</details>)}</aside><main className="api-main"><header className="api-main-header"><div><span className="dashboard-eyebrow">Supported route</span><h2>{selected.title}</h2><p>{selected.path}</p></div><button className="secondary-button compact" type="button" onClick={() => setConsoleRoute(selected)}><Play size={13} /> Test request</button></header><ApiEndpointDetail route={selected} projectId={projectId} onRun={setConsoleRoute} /></main>{consoleRoute ? <RequestConsole route={consoleRoute} projectId={projectId} onClose={() => setConsoleRoute(null)} /> : <aside className="api-console api-console-empty"><Workflow size={22} /><strong>Request console</strong><p>Select an endpoint and test a supported local request. Destructive operations always require confirmation.</p></aside>}</div><footer className="developer-actions"><button className="secondary-button" type="button" onClick={() => downloadText("schevo-openapi.json", JSON.stringify(buildOpenApiSpec(), null, 2), "application/json")}><Download size={14} /> Download OpenAPI JSON</button><span>OpenAPI reflects the current Express routes only.</span></footer></section>;
}

function DocumentationPage() {
  const projects = schemaRepository.list();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(projects[0]?.id || null);
  const [active, setActive] = useState("introduction");
  const selected = projects.find((project) => project.id === selectedId) || projects[0];
  const visibleSections = DOC_SECTIONS.filter(([, label]) => label.toLowerCase().includes(query.toLowerCase()));
  const exportMarkdown = () => downloadText(selected ? `${selected.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-docs.md` : "schevo-docs.md", projectMarkdown(selected), "text/markdown");
  const content = {
    introduction: ["What is Schevo?", <><p>Schevo is a PostgreSQL schema workspace for designing, validating and reviewing database structures before application generation.</p><div className="docs-callout"><strong>Accuracy note</strong><span>Backend generation and schema-derived CRUD APIs are not implemented in the current product. Those surfaces are explicitly marked as previews.</span></div></>],
    "getting-started": ["Getting started", <><p>Create an account, sign in, create a project, and open Design. Sessions are server-side and protected routes require authentication.</p><ol><li>Create a blank project or use a template.</li><li>Add tables and columns in the schema designer.</li><li>Review validation and SQL preview before saving.</li></ol></>],
    dashboard: ["Dashboard", <p>The overview shows saved project counts, schema growth, validation status and recent project activity. Projects, Activity, API Explorer and Documentation are available from the sidebar.</p>],
    projects: ["Project management", <p>Projects are persisted to the signed-in workspace. Open a project to edit its schema, view SQL, inspect history or update project details.</p>],
    designer: ["Schema designer", <p>The explorer lists tables, the canvas arranges them, and the inspector edits selected table properties. Changes are saved through the versioned project API.</p>],
    tables: ["Tables and columns", <p>Create tables from the explorer or canvas. Columns support PostgreSQL types, primary keys, nullability, unique flags, default expressions, identity generation and UUID generation.</p>],
    relationships: ["Relationships", <p>Foreign keys support referenced keys, cardinality, ON DELETE, ON UPDATE, deferrable settings and junction-table creation where the schema model permits it.</p>],
    constraints: ["Constraints and indexes", <p>The designer supports CHECK and composite UNIQUE constraints plus PostgreSQL index methods and partial predicates. Validation reports incompatible keys, actions and index shapes.</p>],
    sql: ["SQL preview", <p>SQL preview renders PostgreSQL DDL from the canonical schema. Review generated keys, defaults, checks, indexes and referential actions before using the exported SQL.</p>],
    integration: ["API integration", <p>Use API Explorer for the actual authentication, project, activity and health routes. Schema-derived resource endpoints are not executable until backend generation exists.</p>],
    troubleshooting: ["Troubleshooting and FAQ", <><p><strong>401:</strong> sign in again. <strong>403:</strong> the browser CSRF cookie may be stale. <strong>409:</strong> reload after a concurrent project update. <strong>Validation errors:</strong> select the problem to return to its table.</p></>],
  };
  const [title, body] = content[active] || content.introduction;
  return <section className="developer-page docs-page"><PageHeader eyebrow="Knowledge centre" title="Documentation" description="Product guidance generated from the current Schevo capabilities and selected project." /><div className="docs-workspace"><aside className="docs-nav"><label className="dashboard-search-input"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search documentation" /></label><strong>Guides</strong>{visibleSections.map(([id, label]) => <button className={active === id ? "is-active" : ""} type="button" key={id} onClick={() => setActive(id)}>{label}</button>)}<strong className="docs-nav-label">Selected project</strong>{projects.map((project) => <button className={selected?.id === project.id ? "is-active" : ""} type="button" key={project.id} onClick={() => setSelectedId(project.id)}><FileText size={13} /> {project.name}</button>)}</aside><article className="docs-article"><div className="docs-breadcrumb"><BookOpen size={14} /> Schevo documentation <span>/</span> {title}</div><h2>{title}</h2>{body}{selected && <section className="project-doc-section"><h3>{selected.name} schema reference</h3><p>{selected.schema.tables.length} tables · {selected.schema.relationships.length} relationships · {selected.schema.tables.reduce((total, table) => total + table.constraints.length, 0)} constraints</p>{selected.schema.tables.map((table) => <div className="project-table-reference" key={table.id}><strong>{table.name}</strong>{table.columns.map((column) => <span key={column.id}><code>{column.name}</code> {column.type}{column.primaryKey ? " · primary key" : ""}{column.defaultExpression ? ` · default ${column.defaultExpression}` : ""}</span>)}</div>)}</section>}<footer className="docs-prev-next"><button className="secondary-button compact" type="button" onClick={() => setActive(DOC_SECTIONS[Math.max(0, DOC_SECTIONS.findIndex(([id]) => id === active) - 1)][0])}>Previous</button><button className="secondary-button compact" type="button" onClick={() => setActive(DOC_SECTIONS[Math.min(DOC_SECTIONS.length - 1, DOC_SECTIONS.findIndex(([id]) => id === active) + 1)][0])}>Next</button></footer></article></div><footer className="developer-actions"><button className="secondary-button" type="button" onClick={exportMarkdown}><Download size={14} /> Download Markdown</button><button className="secondary-button" type="button" onClick={() => downloadText("schevo-openapi.json", JSON.stringify(buildOpenApiSpec(), null, 2), "application/json")}><Download size={14} /> Download OpenAPI JSON</button><button className="secondary-button" type="button" onClick={() => window.print()}><Download size={14} /> Print / save PDF</button><span>PDF uses the browser's print-to-PDF flow; no fake file is generated.</span></footer></section>;
}

export default function DiscoveryPage({ documentation = false }) {
  return documentation ? <DocumentationPage /> : <ApiExplorer />;
}
