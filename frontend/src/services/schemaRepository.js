import { layoutPreview } from "../domain/schema/layout.js";
import { schemaToSql as renderSql } from "../domain/schema/sql.js";
import { validateSchema as diagnoseSchema, validationStatus } from "../domain/schema/validate.js";
import { canonicalizeSchema } from "../domain/schema/model.js";
import { apiRequest } from "./apiClient.js";

const STORAGE_KEY = "schevo-projects";
const ACCOUNT_KEY = "schevo-account-projects";
const ACTIVITY_KEY = "schevo-activity";
const DRAFTS_KEY = "schevo-unsaved-drafts";
let accountMode = false;
let activeAccountId = null;
let memory = null;
const saveQueues = new Map();
const saveTimers = new Map();
const persistenceStates = new Map();
const persistenceListeners = new Map();

function setPersistenceState(id, status, error = "", errorCode = null) {
  const value = { status, error, errorCode };
  persistenceStates.set(id, value);
  (persistenceListeners.get(id) || []).forEach((listener) => listener(value));
}

function draftsKey() {
  return `${DRAFTS_KEY}:${activeAccountId || "anonymous"}`;
}

function readDrafts() {
  try { return JSON.parse(window.localStorage.getItem(draftsKey()) || "{}"); } catch { return {}; }
}

function storeDraft(project) {
  const drafts = readDrafts();
  drafts[project.id] = project;
  window.localStorage.setItem(draftsKey(), JSON.stringify(drafts));
}

function removeDraft(id) {
  const drafts = readDrafts();
  delete drafts[id];
  window.localStorage.setItem(draftsKey(), JSON.stringify(drafts));
}

export function isAccountMode() {
  return accountMode;
}

export function persistenceState(id) {
  return persistenceStates.get(id) || { status: accountMode ? "saved" : "local-only", error: "" };
}

export function subscribePersistence(id, listener) {
  const listeners = persistenceListeners.get(id) || new Set();
  listeners.add(listener);
  persistenceListeners.set(id, listeners);
  listener(persistenceState(id));
  return () => {
    listeners.delete(listener);
    if (!listeners.size) persistenceListeners.delete(id);
  };
}

export function adoptAccountProjects(projects, userId) {
  accountMode = true;
  activeAccountId = userId;
  const remoteProjects = projects.map((project) => ({ ...project, schema: canonicalizeSchema(project.schema) }));
  const drafts = readDrafts();
  memory = remoteProjects.map((project) => {
    const draft = drafts[project.id];
    if (!draft) {
      setPersistenceState(project.id, "clean");
      return project;
    }
    setPersistenceState(project.id, "dirty");
    return { ...project, ...draft, schema: canonicalizeSchema(draft.schema) };
  });
  window.localStorage.setItem(ACCOUNT_KEY, JSON.stringify(memory));
}

export function leaveAccount() {
  const projectIds = (memory || []).map((project) => project.id);
  accountMode = false;
  activeAccountId = null;
  memory = null;
  saveTimers.forEach((timer) => window.clearTimeout(timer));
  saveTimers.clear();
  saveQueues.clear();
  window.localStorage.removeItem(ACCOUNT_KEY);
  projectIds.forEach((id) => setPersistenceState(id, "local-only"));
}

const seedSchema = {
  tables: [
    {
      id: "users",
      name: "users",
      description: "People who use the application.",
      x: 90,
      y: 80,
      columns: [
        { id: "users-id", name: "id", type: "uuid", primaryKey: true, nullable: false },
        { id: "users-email", name: "email", type: "varchar(255)", unique: true, nullable: false },
        { id: "users-created", name: "created_at", type: "timestamptz", nullable: false, defaultValue: "now()" },
      ],
    },
    {
      id: "orders",
      name: "orders",
      description: "Orders placed by customers.",
      x: 430,
      y: 210,
      columns: [
        { id: "orders-id", name: "id", type: "uuid", primaryKey: true, nullable: false },
        { id: "orders-user", name: "user_id", type: "uuid", foreignKey: "users.id", nullable: false },
        { id: "orders-status", name: "status", type: "varchar(32)", nullable: false, defaultValue: "'pending'" },
      ],
    },
  ],
  relationships: [
    { id: "users-orders", sourceTable: "users", sourceColumn: "id", targetTable: "orders", targetColumn: "user_id", kind: "one-to-many" },
  ],
};
const templateDefinitions = {
  blog: {
    name: "Blog / CMS", description: "Posts, authors, comments and publishing workflows.", useCase: "Publishing platforms and content teams.",
    tables: [
      ["authors", [["id", "uuid", true], ["name", "varchar(120)", false]]],
      ["posts", [["id", "uuid", true], ["author_id", "uuid", false], ["title", "varchar(180)", false], ["body", "text", false]]],
      ["comments", [["id", "uuid", true], ["post_id", "uuid", false], ["body", "text", false]]],
      ["tags", [["id", "uuid", true], ["name", "varchar(80)", false]]],
      ["post_tags", [["post_id", "uuid", true], ["tag_id", "uuid", true]]],
    ],
    relationships: [["authors", "id", "posts", "author_id"], ["posts", "id", "comments", "post_id"], ["posts", "id", "post_tags", "post_id"], ["tags", "id", "post_tags", "tag_id"]],
  },
  commerce: {
    name: "E-commerce", description: "Products, carts, orders and customer accounts.", useCase: "Online stores and checkout workflows.",
    tables: [
      ["customers", [["id", "uuid", true], ["email", "varchar(255)", false]]],
      ["products", [["id", "uuid", true], ["name", "varchar(180)", false], ["price", "integer", false]]],
      ["orders", [["id", "uuid", true], ["customer_id", "uuid", false], ["status", "varchar(32)", false]]],
      ["order_items", [["order_id", "uuid", true], ["product_id", "uuid", true], ["quantity", "integer", false]]],
    ],
    relationships: [["customers", "id", "orders", "customer_id"], ["orders", "id", "order_items", "order_id"], ["products", "id", "order_items", "product_id"]],
  },
  tasks: {
    name: "Task Management", description: "Teams, projects, tasks and assignments.", useCase: "Product teams managing delivery work.",
    tables: [
      ["teams", [["id", "uuid", true], ["name", "varchar(120)", false]]],
      ["projects", [["id", "uuid", true], ["team_id", "uuid", false], ["name", "varchar(160)", false]]],
      ["tasks", [["id", "uuid", true], ["project_id", "uuid", false], ["title", "varchar(180)", false], ["done", "boolean", false]]],
      ["members", [["id", "uuid", true], ["team_id", "uuid", false], ["email", "varchar(255)", false]]],
    ],
    relationships: [["teams", "id", "projects", "team_id"], ["projects", "id", "tasks", "project_id"], ["teams", "id", "members", "team_id"]],
  },
  crm: {
    name: "CRM", description: "Contacts, companies, deals and activities.", useCase: "Sales pipelines and customer relationships.",
    tables: [
      ["companies", [["id", "uuid", true], ["name", "varchar(160)", false]]],
      ["contacts", [["id", "uuid", true], ["company_id", "uuid", false], ["email", "varchar(255)", false]]],
      ["deals", [["id", "uuid", true], ["company_id", "uuid", false], ["value", "integer", false]]],
      ["activities", [["id", "uuid", true], ["contact_id", "uuid", false], ["kind", "varchar(40)", false]]],
    ],
    relationships: [["companies", "id", "contacts", "company_id"], ["companies", "id", "deals", "company_id"], ["contacts", "id", "activities", "contact_id"]],
  },
  auth: {
    name: "Authentication & RBAC", description: "Users, roles, permissions and sessions.", useCase: "Secure applications with role-based access.",
    tables: [
      ["users", [["id", "uuid", true], ["email", "varchar(255)", false]]],
      ["roles", [["id", "uuid", true], ["name", "varchar(80)", false]]],
      ["permissions", [["id", "uuid", true], ["name", "varchar(120)", false]]],
      ["user_roles", [["user_id", "uuid", true], ["role_id", "uuid", true]]],
      ["role_permissions", [["role_id", "uuid", true], ["permission_id", "uuid", true]]],
      ["sessions", [["id", "uuid", true], ["user_id", "uuid", false], ["expires_at", "timestamptz", false]]],
    ],
    relationships: [["users", "id", "user_roles", "user_id"], ["roles", "id", "user_roles", "role_id"], ["roles", "id", "role_permissions", "role_id"], ["permissions", "id", "role_permissions", "permission_id"], ["users", "id", "sessions", "user_id"]],
  },
  events: {
    name: "Event Tracking", description: "Flexible events and analytics properties.", useCase: "Product analytics and audit trails.",
    tables: [
      ["event_types", [["id", "uuid", true], ["name", "varchar(80)", false]]],
      ["events", [["id", "uuid", true], ["event_type_id", "uuid", false], ["occurred_at", "timestamptz", false], ["properties", "jsonb", true]]],
      ["event_sources", [["id", "uuid", true], ["name", "varchar(80)", false]]],
      ["event_source_links", [["event_id", "uuid", true], ["source_id", "uuid", true]]],
    ],
    relationships: [["event_types", "id", "events", "event_type_id"], ["events", "id", "event_source_links", "event_id"], ["event_sources", "id", "event_source_links", "source_id"]],
  },
};

const templates = Object.entries(templateDefinitions).map(([id, definition]) => ({
  id, ...definition, tables: definition.tables.length, relationships: definition.relationships.length,
}));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readProjects() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function writeProjects(value) {
  if (accountMode) {
    memory = value;
    window.localStorage.setItem(ACCOUNT_KEY, JSON.stringify(value));
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

function ensureProjects() {
  if (accountMode) {
    if (!memory) {
      try {
        memory = JSON.parse(window.localStorage.getItem(ACCOUNT_KEY) || "[]");
      } catch {
        memory = [];
      }
    }
    return memory;
  }
  const stored = readProjects();
  if (stored) return stored;
  const projects = [
    {
      id: "commerce-api",
      name: "Commerce API",
      description: "PostgreSQL schema for products, orders and customers.",
      modifiedAt: "2026-11-22T10:30:00.000Z",
      tableCount: 2,
      relationshipCount: 1,
      validation: "Warnings",
      generation: "Out of date",
      starred: true,
      schema: clone(seedSchema),
      lastArea: "design",
    },
  ];
  writeProjects(projects);
  return projects;
}

export function getTemplates() {
  return templates;
}

export function createSchemaFromTemplate(templateId) {
  const definition = templateDefinitions[templateId];
  if (!definition) return { tables: [], relationships: [] };
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const tables = definition.tables.map(([name, columns], index) => ({
    id: `${name}-${suffix}`, name, description: `${name} data`, x: 80 + (index % 3) * 280, y: 70 + Math.floor(index / 3) * 220,
    columns: columns.map(([columnName, type, primaryKey]) => ({
      id: `${name}-${columnName}-${suffix}`, name: columnName, type, primaryKey, nullable: !primaryKey,
    })),
  }));
  const relationships = definition.relationships.map(([sourceName, sourceColumnName, targetName, targetColumnName], index) => {
    const source = tables.find((table) => table.name === sourceName);
    const target = tables.find((table) => table.name === targetName);
    const sourceColumn = source.columns.find((column) => column.name === sourceColumnName);
    const targetColumn = target.columns.find((column) => column.name === targetColumnName);
    targetColumn.foreignKey = `${source.name}.${sourceColumn.name}`;
    return {
      id: `relationship-${suffix}-${index}`,
      sourceTable: source.id,
      sourceColumn: sourceColumn.id,
      targetTable: target.id,
      targetColumn: targetColumn.id,
      kind: "one-to-many",
      onDelete: "NO ACTION",
      onUpdate: "NO ACTION",
    };
  });
  return canonicalizeSchema({ tables, relationships });
}

export function recordActivity(event) {
  try {
    const current = JSON.parse(window.localStorage.getItem(ACTIVITY_KEY) || "[]");
    current.unshift({ id: `event-${Date.now()}`, at: new Date().toISOString(), ...event });
    window.localStorage.setItem(ACTIVITY_KEY, JSON.stringify(current.slice(0, 80)));
  } catch {
    /* activity is local and optional */
  }
}

export function readActivity() {
  try {
    return JSON.parse(window.localStorage.getItem(ACTIVITY_KEY) || "[]");
  } catch {
    return [];
  }
}

export function validateSchema(schema) {
  return diagnoseSchema(schema || { tables: [], relationships: [] });
}

export function schemaToSql(schema) {
  return renderSql(schema || { tables: [], relationships: [] });
}

export { layoutPreview, validationStatus };

function queueAccountSave(id) {
  const inFlight = saveQueues.get(id);
  if (inFlight) return inFlight;
  const previous = saveQueues.get(id) || Promise.resolve();
  const next = previous.catch(() => undefined).then(async () => {
    const project = ensureProjects().find((item) => item.id === id);
    if (!project) return;
    setPersistenceState(id, "saving");
    const body = {
      name: project.name,
      description: project.description,
      schema: project.schema,
      tableCount: project.tableCount,
      relationshipCount: project.relationshipCount,
      validation: project.validation,
      generation: project.generation,
      starred: Boolean(project.starred),
      version: project.version,
    };
    try {
      const data = await apiRequest(`/api/v1/projects/${id}`, { method: "PATCH", body });
      const projects = ensureProjects();
      const index = projects.findIndex((item) => item.id === id);
      if (index >= 0) {
        const changedDuringSave = projects[index].modifiedAt !== project.modifiedAt;
        projects[index] = { ...projects[index], version: data.project.version, modifiedAt: changedDuringSave ? projects[index].modifiedAt : data.project.modifiedAt };
        writeProjects(projects);
        if (changedDuringSave) {
          storeDraft(projects[index]);
          setPersistenceState(id, "dirty");
          scheduleAccountSave(id);
          return data.project;
        }
      }
      removeDraft(id);
      setPersistenceState(id, "saved");
      return data.project;
    } catch (error) {
      setPersistenceState(id, "save-failed", error.message || "Could not save this project.", error.status || null);
      throw error;
    }
  });
  saveQueues.set(id, next);
  next.then(() => {
    if (saveQueues.get(id) === next) saveQueues.delete(id);
  }, () => {
    if (saveQueues.get(id) === next) saveQueues.delete(id);
  });
  return next;
}

function scheduleAccountSave(id) {
  const previousTimer = saveTimers.get(id);
  if (previousTimer) window.clearTimeout(previousTimer);
  const timer = window.setTimeout(() => {
    saveTimers.delete(id);
    queueAccountSave(id).catch(() => undefined);
  }, 350);
  saveTimers.set(id, timer);
}

export function saveProjectNow(id) {
  const timer = saveTimers.get(id);
  if (timer) window.clearTimeout(timer);
  saveTimers.delete(id);
  if (!accountMode) return Promise.resolve(schemaRepository.get(id));
  return queueAccountSave(id);
}

export const schemaRepository = {
  list() {
    return clone(ensureProjects().map((project) => ({ ...project, schema: canonicalizeSchema(project.schema) })));
  },
  get(id) {
    const project = ensureProjects().find((item) => item.id === id);
    return project ? clone({ ...project, schema: canonicalizeSchema(project.schema) }) : null;
  },
  async create({ name, description, templateId }) {
    const schema = templateId ? createSchemaFromTemplate(templateId) : canonicalizeSchema({ tables: [], relationships: [] });
    if (accountMode) {
      const data = await apiRequest("/api/v1/projects", {
        method: "POST",
        body: {
          name,
          description: description || "A new PostgreSQL schema.",
          schema,
          tableCount: schema.tables.length,
          relationshipCount: schema.relationships.length,
          validation: "Not validated",
          generation: "Never generated",
        },
      });
      const projects = ensureProjects();
      projects.unshift(data.project);
      writeProjects(projects);
      setPersistenceState(data.project.id, "saved");
      return clone(data.project);
    }
    const projects = ensureProjects();
    const project = {
      id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
      name,
      description: description || "A new PostgreSQL schema.",
      modifiedAt: new Date().toISOString(),
      tableCount: 0,
      relationshipCount: 0,
      validation: "Not validated",
      generation: "Never generated",
      starred: false,
      schema,
      lastArea: "design",
    };
    project.tableCount = project.schema.tables.length;
    project.relationshipCount = project.schema.relationships.length;
    projects.unshift(project);
    writeProjects(projects);
    recordActivity({ kind: "project.created", message: `Created project “${project.name}”.`, projectId: project.id, projectName: project.name });
    setPersistenceState(project.id, "local-only");
    return clone(project);
  },
  update(id, patch) {
    const projects = ensureProjects();
    const index = projects.findIndex((project) => project.id === id);
    if (index < 0) throw new Error("Project not found");
    projects[index] = { ...projects[index], ...clone(patch), schema: patch.schema ? canonicalizeSchema(patch.schema) : projects[index].schema, modifiedAt: new Date().toISOString() };
    writeProjects(projects);
    if (accountMode) {
      storeDraft(projects[index]);
      setPersistenceState(id, "dirty");
      scheduleAccountSave(id);
    } else {
      setPersistenceState(id, "local-only");
    }
    return clone(projects[index]);
  },
};
