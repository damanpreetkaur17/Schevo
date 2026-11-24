import test from "node:test";
import assert from "node:assert/strict";
import { adoptAccountProjects, leaveAccount, persistenceState, saveProjectNow, schemaRepository, subscribePersistence } from "./schemaRepository.js";

const values = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  },
  setTimeout,
  clearTimeout,
};
globalThis.document = { cookie: "schevo.csrf=test-token" };

const serverProject = () => ({
  id: "project-test",
  name: "Persistence test",
  description: "",
  schema: { schemaVersion: 2, tables: [{ id: "table-test", name: "items", columns: [{ id: "column-test", name: "title", type: "text" }], constraints: [], indexes: [] }], relationships: [] },
  version: 1,
  modifiedAt: "2026-01-01T00:00:00.000Z",
});

function response(status, data) {
  return { ok: status >= 200 && status < 300, status, json: async () => data };
}

function editProject() {
  const project = schemaRepository.get("project-test");
  const schema = structuredClone(project.schema);
  schema.tables[0].columns[0].defaultExpression = "'draft'";
  schemaRepository.update(project.id, { schema });
}

test("account saves report dirty, saving and saved only after server confirmation", async () => {
  leaveAccount();
  adoptAccountProjects([serverProject()], "persistence-user");
  const seen = [];
  const unsubscribe = subscribePersistence("project-test", (state) => seen.push(state.status));
  editProject();
  assert.equal(persistenceState("project-test").status, "dirty");
  let finish;
  globalThis.fetch = () => new Promise((resolve) => { finish = resolve; });
  const saving = saveProjectNow("project-test");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(persistenceState("project-test").status, "saving");
  finish(response(200, { project: { version: 2, modifiedAt: "2026-01-02T00:00:00.000Z" } }));
  await saving;
  assert.equal(persistenceState("project-test").status, "saved");
  assert.deepEqual(seen.slice(-3), ["dirty", "saving", "saved"]);
  unsubscribe();
});

test("failed and disconnected saves preserve drafts and retry successfully", async () => {
  leaveAccount();
  adoptAccountProjects([serverProject()], "persistence-user");
  editProject();
  globalThis.fetch = async () => response(503, { message: "Service unavailable" });
  await assert.rejects(saveProjectNow("project-test"), /Service unavailable/);
  assert.equal(persistenceState("project-test").status, "save-failed");
  assert.ok(values.get("schevo-unsaved-drafts:persistence-user").includes("'draft'"));
  globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
  await assert.rejects(saveProjectNow("project-test"), /Failed to fetch/);
  assert.equal(persistenceState("project-test").status, "save-failed");
  globalThis.fetch = async () => response(200, { project: { version: 2, modifiedAt: "2026-01-02T00:00:00.000Z" } });
  await saveProjectNow("project-test");
  assert.equal(persistenceState("project-test").status, "saved");
  assert.equal(JSON.parse(values.get("schevo-unsaved-drafts:persistence-user") || "{}")["project-test"], undefined);
});

test("refresh restores a local draft and a version conflict never overwrites it", async () => {
  leaveAccount();
  adoptAccountProjects([serverProject()], "persistence-user");
  editProject();
  leaveAccount();
  adoptAccountProjects([serverProject()], "persistence-user");
  assert.equal(persistenceState("project-test").status, "dirty");
  assert.equal(schemaRepository.get("project-test").schema.tables[0].columns[0].defaultExpression, "'draft'");
  let patchBody;
  globalThis.fetch = async (_url, options) => {
    patchBody = JSON.parse(options.body);
    return response(409, { message: "Project version conflict." });
  };
  await assert.rejects(saveProjectNow("project-test"), /version conflict/i);
  assert.equal(persistenceState("project-test").errorCode, 409);
  assert.equal(schemaRepository.get("project-test").schema.tables[0].columns[0].defaultExpression, "'draft'");
  assert.equal(patchBody.version, 1);
  assert.ok(values.get("schevo-unsaved-drafts:persistence-user").includes("'draft'"));
});

test("simultaneous save requests share one request and preview mode stays local", async () => {
  leaveAccount();
  adoptAccountProjects([serverProject()], "persistence-user");
  editProject();
  let calls = 0;
  let finish;
  globalThis.fetch = () => { calls += 1; return new Promise((resolve) => { finish = resolve; }); };
  const first = saveProjectNow("project-test");
  const second = saveProjectNow("project-test");
  assert.equal(first, second);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(calls, 1);
  finish(response(200, { project: { version: 2, modifiedAt: "2026-01-02T00:00:00.000Z" } }));
  await Promise.all([first, second]);
  leaveAccount();
  assert.equal(persistenceState("project-test").status, "local-only");
  const project = await schemaRepository.create({ name: "Preview mode", description: "" });
  schemaRepository.update(project.id, { name: "Local edit" });
  assert.equal(persistenceState("project-test").status, "local-only");
});
