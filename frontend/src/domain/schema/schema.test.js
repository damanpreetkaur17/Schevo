import assert from "node:assert/strict";
import test from "node:test";
import { createJunctionTable, setForeignKey, setForeignKeyColumns } from "./mutate.js";
import { canonicalizeSchema } from "./model.js";
import { schemaToSql } from "./sql.js";
import { validateSchema } from "./validate.js";

function column(partial) {
  return { nullable: true, primaryKey: false, unique: false, ...partial };
}

function schema() {
  return {
    tables: [
      {
        id: "users",
        name: "users",
        columns: [
          column({ id: "users-id", name: "id", type: "uuid", primaryKey: true, nullable: false }),
          column({ id: "users-email", name: "email", type: "varchar(255)", unique: true, nullable: false }),
        ],
      },
      {
        id: "orders",
        name: "orders",
        columns: [
          column({ id: "orders-id", name: "id", type: "uuid", primaryKey: true, nullable: false }),
          column({ id: "orders-user", name: "user_id", type: "uuid", nullable: false }),
        ],
      },
    ],
    relationships: [],
  };
}

test("primary key SQL is a single table constraint and implies NOT NULL", () => {
  const sql = schemaToSql(schema());
  assert.match(sql, /PRIMARY KEY \("id"\)/);
  assert.equal(sql.match(/PRIMARY KEY/g).length, 2);
  assert.match(sql, /"id" UUID[\s\S]*NOT NULL/);
});

test("composite primary key is emitted once", () => {
  const model = schema();
  model.tables.push({
    id: "post_tags",
    name: "post_tags",
    columns: [
      column({ id: "pt-post", name: "post_id", type: "uuid", primaryKey: true, nullable: false }),
      column({ id: "pt-tag", name: "tag_id", type: "uuid", primaryKey: true, nullable: false }),
    ],
  });
  const sql = schemaToSql(model);
  assert.match(sql, /PRIMARY KEY \("post_id", "tag_id"\)/);
  assert.equal((sql.match(/PRIMARY KEY/g) || []).length, 3);
});

test("foreign key to a primary key is valid and includes referential actions", () => {
  const model = setForeignKey(schema(), {
    tableId: "orders",
    columnId: "orders-user",
    referencedTableId: "users",
    referencedColumnId: "users-id",
    onDelete: "CASCADE",
    onUpdate: "NO ACTION",
  });
  const problems = validateSchema(model);
  assert.equal(problems.filter((problem) => problem.severity === "error").length, 0);
  const sql = schemaToSql(model);
  assert.match(sql, /FOREIGN KEY \("user_id"\) REFERENCES "users" \("id"\) ON DELETE CASCADE ON UPDATE NO ACTION/);
});

test("foreign key to a non-unique column is rejected", () => {
  const model = schema();
  model.tables[0].columns.push(column({ id: "users-name", name: "name", type: "text", nullable: true }));
  const next = setForeignKey(model, {
    tableId: "orders",
    columnId: "orders-user",
    referencedTableId: "users",
    referencedColumnId: "users-name",
  });
  const problems = validateSchema(next);
  assert.ok(problems.some((problem) => problem.code === "fk.target.not-unique"));
});

test("SET NULL is rejected when the referencing column is required", () => {
  const model = setForeignKey(schema(), {
    tableId: "orders",
    columnId: "orders-user",
    referencedTableId: "users",
    referencedColumnId: "users-id",
    onDelete: "SET NULL",
  });
  assert.ok(validateSchema(model).some((problem) => problem.code === "fk.set-null.not-null"));
});

test("incompatible foreign key types are rejected", () => {
  const model = schema();
  model.tables[1].columns[1].type = "integer";
  const next = setForeignKey(model, {
    tableId: "orders",
    columnId: "orders-user",
    referencedTableId: "users",
    referencedColumnId: "users-id",
  });
  assert.ok(validateSchema(next).some((problem) => problem.code === "fk.type"));
});

test("integer foreign keys allow PostgreSQL's cross-width integer family", () => {
  const model = schema();
  model.tables[0].columns[0].type = "bigint";
  model.tables[1].columns[1].type = "integer";
  const linked = setForeignKey(model, { tableId: "orders", columnId: "orders-user", referencedTableId: "users", referencedColumnId: "users-id" });
  assert.equal(validateSchema(linked).some((problem) => problem.code === "fk.type"), false);
});

test("one-to-one requires uniqueness on the referencing column", () => {
  const model = setForeignKey(schema(), {
    tableId: "orders",
    columnId: "orders-user",
    referencedTableId: "users",
    referencedColumnId: "users-id",
    cardinality: "one-to-one",
  });
  assert.equal(model.tables[1].columns[1].unique, true);
  const sql = schemaToSql(model);
  assert.match(sql, /UNIQUE \("user_id"\)/);
  assert.equal(validateSchema(model).some((problem) => problem.code === "fk.one-to-one.unique"), false);
});

test("identity is limited to integer types", () => {
  const model = schema();
  model.tables[0].columns[0].identity = true;
  assert.ok(validateSchema(model).some((problem) => problem.code === "column.identity.type"));
  model.tables[0].columns[0].type = "bigint";
  model.tables[0].columns[0].identity = true;
  assert.equal(validateSchema(model).some((problem) => problem.code === "column.identity.type"), false);
});

test("nullable unique column does not block a foreign key", () => {
  const model = schema();
  model.tables[0].columns[1].nullable = true;
  const next = setForeignKey(model, {
    tableId: "orders",
    columnId: "orders-user",
    referencedTableId: "users",
    referencedColumnId: "users-email",
  });
  assert.equal(validateSchema(next).some((problem) => problem.code === "fk.target.not-unique"), false);
});

test("legacy schema upgrades to a versioned document without changing entity IDs", () => {
  const legacy = schema();
  legacy.relationships.push({ id: "users-orders", sourceTable: "users", sourceColumn: "users-id", targetTable: "orders", targetColumn: "orders-user", kind: "one-to-many" });
  const upgraded = canonicalizeSchema(legacy);
  assert.equal(upgraded.schemaVersion, 2);
  assert.equal(upgraded.tables[0].id, "users");
  assert.equal(upgraded.tables[0].columns[0].id, "users-id");
  assert.ok(upgraded.tables[0].constraints.some((constraint) => constraint.type === "primaryKey"));
  assert.ok(upgraded.tables[1].constraints.some((constraint) => constraint.type === "foreignKey"));
});

test("tables without saved positions receive separated canvas positions", () => {
  const positioned = canonicalizeSchema({
    tables: [
      { id: "first", name: "first", columns: [{ id: "first-id", name: "id", type: "uuid" }] },
      { id: "second", name: "second", columns: [{ id: "second-id", name: "id", type: "uuid" }] },
      { id: "third", name: "third", columns: [{ id: "third-id", name: "id", type: "uuid" }] },
      { id: "fourth", name: "fourth", columns: [{ id: "fourth-id", name: "id", type: "uuid" }] },
    ],
  });

  const points = positioned.tables.map(({ x, y }) => `${x},${y}`);
  assert.equal(new Set(points).size, positioned.tables.length);
  assert.equal(positioned.tables[0].x, 80);
  assert.equal(positioned.tables[1].x, 380);
  assert.ok(positioned.tables[3].y > positioned.tables[0].y);
});

test("legacy add-table offsets are migrated while custom saved positions stay unchanged", () => {
  const legacyDefaults = canonicalizeSchema({
    tables: [
      { id: "first", name: "first", x: 120, y: 120, columns: [] },
      { id: "second", name: "second", x: 150, y: 150, columns: [] },
    ],
  });
  const customPositions = canonicalizeSchema({
    tables: [
      { id: "first", name: "first", x: 120, y: 120, columns: [] },
      { id: "second", name: "second", x: 190, y: 200, columns: [] },
    ],
  });

  assert.deepEqual(legacyDefaults.tables.map(({ x, y }) => ({ x, y })), [{ x: 80, y: 70 }, { x: 380, y: 70 }]);
  assert.deepEqual(customPositions.tables.map(({ x, y }) => ({ x, y })), [{ x: 120, y: 120 }, { x: 190, y: 200 }]);
});

test("canonicalization keeps moved positions in sync with serialized coordinates", () => {
  const original = canonicalizeSchema({
    schemaVersion: 2,
    tables: [{ id: "users", name: "users", x: 80, y: 90, columns: [] }],
  });
  const moved = canonicalizeSchema({
    ...original,
    tables: original.tables.map((table) => ({ ...table, name: "accounts", x: 410, y: 270 })),
  });

  assert.deepEqual(moved.tables[0].position, { x: 410, y: 270 });
  assert.equal(moved.tables[0].x, 410);
  assert.equal(moved.tables[0].y, 270);
});

test("versioned canonical constraints remain authoritative when a constraint is removed", async () => {
  const { canonicalizeSchema } = await import("./model.js");
  const document = canonicalizeSchema({ schemaVersion: 2, tables: [{ id: "t", name: "t", columns: [{ id: "a", name: "a", type: "text", unique: true }], constraints: [{ id: "uq-a", type: "unique", columns: ["a"] }] }] });
  const withoutUnique = canonicalizeSchema({ ...document, tables: document.tables.map((table) => ({ ...table, constraints: [] })) });
  assert.equal(withoutUnique.tables[0].constraints.some((constraint) => constraint.type === "unique"), false);
  assert.equal(withoutUnique.tables[0].columns[0].unique, false);
});

test("multiple primary-key constraints are rejected", () => {
  const model = schema();
  model.tables[0].constraints = [
    { id: "pk-a", type: "primaryKey", columns: ["users-id"] },
    { id: "pk-b", type: "primaryKey", columns: ["users-email"] },
  ];
  assert.ok(validateSchema(model).some((problem) => problem.code === "table.pk.multiple"));
});

test("composite unique keys, foreign keys and SQL use the complete key", () => {
  const model = schema();
  model.tables[0].constraints = [];
  model.tables[0].constraints.push({ id: "uq-region-code", type: "unique", columns: ["users-id", "users-email"] });
  model.tables[1].constraints = [];
  model.tables[1].columns.push(column({ id: "orders-region", name: "region_id", type: "uuid", nullable: false }));
  const linked = setForeignKeyColumns(model, {
    tableId: "orders",
    columns: ["orders-user", "orders-region"],
    referencedTableId: "users",
    referencedColumns: ["users-id", "users-email"],
    onDelete: "CASCADE",
    cardinality: "one-to-many",
  });
  assert.equal(validateSchema(linked).some((problem) => problem.severity === "error"), true);
  linked.tables[0].columns.find((item) => item.id === "users-email").type = "uuid";
  assert.equal(validateSchema(linked).some((problem) => problem.severity === "error"), false);
  const sql = schemaToSql(linked);
  assert.match(sql, /UNIQUE \("id", "email"\)/);
  assert.match(sql, /FOREIGN KEY \("user_id", "region_id"\) REFERENCES "users" \("id", "email"\)/);
});

test("foreign key cannot reference only part of a composite unique key", () => {
  const model = schema();
  model.tables[0].constraints = [];
  model.tables[0].columns.push(column({ id: "users-region", name: "region_id", type: "uuid" }), column({ id: "users-code", name: "code_id", type: "uuid" }));
  model.tables[0].constraints.push({ id: "uq-region-code", type: "unique", columns: ["users-region", "users-code"] });
  const linked = setForeignKey(model, {
    tableId: "orders",
    columnId: "orders-user",
    referencedTableId: "users",
    referencedColumnId: "users-region",
  });
  assert.ok(validateSchema(linked).some((problem) => problem.code === "fk.target.not-unique"));
});

test("check constraints, deferrable references and partial indexes generate PostgreSQL SQL", () => {
  const model = setForeignKey(schema(), {
    tableId: "orders",
    columnId: "orders-user",
    referencedTableId: "users",
    referencedColumnId: "users-id",
  });
  const fk = model.tables[1].constraints.find((constraint) => constraint.type === "foreignKey");
  fk.deferrable = true;
  fk.initiallyDeferred = true;
  model.tables[1].constraints.push({ id: "ck-orders-status", type: "check", name: "orders_status_valid", columns: ["orders-id"], expression: "status IN ('open', 'closed')" });
  model.tables[1].indexes.push({ id: "idx-orders-status", name: "orders_status_idx", columns: ["orders-user"], method: "btree", options: { where: "status = 'open'" } });
  const sql = schemaToSql(model);
  assert.match(sql, /CHECK \(status IN \('open', 'closed'\)\)/);
  assert.match(sql, /DEFERRABLE INITIALLY DEFERRED/);
  assert.match(sql, /CREATE INDEX "orders_status_idx" ON "orders" USING BTREE \("user_id"\) WHERE status = 'open'/);
});

test("table-level check constraints may omit column metadata", () => {
  const model = schema();
  model.tables[0].constraints = [{ id: "users-check", type: "check", name: "users_email_shape", columns: [], expression: "length(email) > 2" }];
  const problems = validateSchema(model);
  assert.equal(problems.some((problem) => problem.code === "constraint.columns.invalid"), false);
  assert.equal(problems.some((problem) => problem.code === "constraint.check.empty"), false);
});

test("validator diagnoses invalid targets, actions, duplicate relationships, and index options structurally", () => {
  const model = setForeignKey(schema(), { tableId: "orders", columnId: "orders-user", referencedTableId: "users", referencedColumnId: "users-id" });
  const fk = model.tables[1].constraints.find((constraint) => constraint.type === "foreignKey");
  fk.referencedTableId = "missing-table";
  fk.onDelete = "EXPLODE";
  model.tables[1].indexes.push({ id: "bad-index", name: "bad-index", columns: ["orders-user", "orders-user"], unique: true, method: "gin", options: { include: ["orders-user"], fillfactor: 80 } });
  const duplicate = { ...model.relationships[0], id: "duplicate-edge" };
  model.relationships.push(duplicate);
  const problems = validateSchema(model);
  for (const code of ["fk.columns.invalid", "relationship.duplicate", "index.columns.duplicate", "index.include.key.duplicate", "index.include.method", "index.unique.method", "index.options.unsupported"]) {
    const issue = problems.find((problem) => problem.code === code);
    assert.ok(issue, `expected diagnostic ${code}`);
    assert.ok(issue.severity && issue.message && issue.entity && issue.suggestion);
  }
});

test("validator reports duplicate names and invalid composite constraint definitions", () => {
  const model = schema();
  model.tables[0].constraints = [
    { id: "unique-one", name: "repeated_name", type: "unique", columns: ["users-id"] },
    { id: "unique-two", name: "repeated_name", type: "unique", columns: ["users-email", "missing-column"] },
    { id: "pk-one", type: "primaryKey", columns: ["users-id"] },
    { id: "pk-two", type: "primaryKey", columns: ["users-email"] },
  ];
  const problems = validateSchema(model);
  for (const code of ["constraint.name.duplicate", "constraint.columns.invalid", "table.pk.multiple"]) assert.ok(problems.some((problem) => problem.code === code));
});

test("validator diagnoses invalid identity, UUID generation, and SET NULL combinations", () => {
  const model = setForeignKey(schema(), { tableId: "orders", columnId: "orders-user", referencedTableId: "users", referencedColumnId: "users-id", onDelete: "SET NULL" });
  model.tables[0].columns[0].identity = { mode: "SOMEDAY" };
  model.tables[0].columns[1].uuidGeneration = "unknown_generator";
  const problems = validateSchema(model);
  for (const code of ["column.identity.mode", "column.uuid.generation", "fk.set-null.not-null"]) assert.ok(problems.some((problem) => problem.code === code));
});

test("validator retains valid PostgreSQL variants and rejects unsupported index shapes", () => {
  const source = schema();
  source.tables[0].columns[1].uuidGeneration = "uuid_generate_v4";
  source.tables[0].columns[1].type = "uuid";
  const uuidSql = schemaToSql(source);
  assert.match(uuidSql, /DEFAULT uuid_generate_v4\(\)/);
  assert.ok(!validateSchema(source).some((item) => item.code === "column.uuid.generation"));

  source.tables[0].indexes = [{ id: "hash-multi", name: "shared_idx", method: "hash", columns: ["users-id", "users-email"] }];
  source.tables[1].indexes = [{ id: "other", name: "shared_idx", method: "btree", columns: ["orders-id"] }];
  const problems = validateSchema(source);
  assert.ok(problems.some((item) => item.code === "index.method.columns"));
  assert.ok(problems.some((item) => item.code === "index.name.duplicate"));
  assert.ok(problems.every((item) => item.code !== "index.name.duplicate" || (item.severity === "error" && item.suggestion && item.entity)));
});

test("distinct composite relationship mappings and foreign-key targets remain valid", () => {
  const source = schema();
  source.tables[0].columns.forEach((item) => { item.type = "text"; });
  source.tables[1].columns.forEach((item) => { item.type = "text"; });
  source.tables[0].constraints = [
    { id: "users-pk", type: "primaryKey", columns: ["users-id"] },
    { id: "users-composite-uq", type: "unique", columns: ["users-id", "users-email"] },
  ];
  source.tables[1].constraints = [
    { id: "orders-pk", type: "primaryKey", columns: ["orders-id"] },
    { id: "orders-composite-uq", type: "unique", columns: ["orders-id", "orders-user"] },
  ];
  source.relationships = [
    { id: "mapping-one", sourceTable: "users", sourceColumns: ["users-id", "users-email"], targetTable: "orders", targetColumns: ["orders-id", "orders-user"], cardinality: "one-to-many" },
    { id: "mapping-two", sourceTable: "users", sourceColumns: ["users-id", "users-email"], targetTable: "orders", targetColumns: ["orders-user", "orders-id"], cardinality: "one-to-many" },
  ];
  const problems = validateSchema(source);
  assert.equal(problems.some((item) => item.code === "relationship.duplicate"), false, JSON.stringify(problems.map(({ code, message }) => ({ code, message }))));

  const foreignKeys = schema();
  foreignKeys.tables.push({ id: "teams", name: "teams", columns: [column({ id: "teams-id", name: "id", type: "uuid", primaryKey: true, nullable: false })], constraints: [{ id: "teams-pk", type: "primaryKey", columns: ["teams-id"] }] });
  foreignKeys.tables[1].constraints = [
    { id: "orders-pk", type: "primaryKey", columns: ["orders-id"] },
    { id: "orders-user-fk", type: "foreignKey", columns: ["orders-user"], referencedTableId: "users", referencedColumns: ["users-id"] },
    { id: "orders-team-fk", type: "foreignKey", columns: ["orders-user"], referencedTableId: "teams", referencedColumns: ["teams-id"] },
  ];
  assert.equal(validateSchema(foreignKeys).some((item) => item.code === "fk.duplicate"), false);
});

test("CHECK constraints cannot be deferred by PostgreSQL", () => {
  const source = schema();
  source.tables[0].constraints = [{ id: "check-deferred", type: "check", columns: [], expression: "true", deferrable: true }];
  assert.ok(validateSchema(source).some((item) => item.code === "constraint.check.deferrable"));
});

test("many-to-many helper creates a composite-key junction with two foreign keys", () => {
  const junctionSchema = createJunctionTable(schema(), {
    leftTableId: "users",
    leftColumns: ["users-id"],
    rightTableId: "orders",
    rightColumns: ["orders-id"],
    name: "user_orders_link",
  });
  const junction = junctionSchema.tables.find((table) => table.name === "user_orders_link");
  assert.equal(junction.constraints.filter((constraint) => constraint.type === "foreignKey").length, 2);
  assert.equal(junction.constraints.find((constraint) => constraint.type === "primaryKey").columns.length, 2);
  assert.equal(validateSchema(junctionSchema).some((problem) => problem.severity === "error"), false);
  const sql = schemaToSql(junctionSchema);
  assert.match(sql, /CREATE TABLE "user_orders_link"/);
  assert.match(sql, /FOREIGN KEY \("left_id"\) REFERENCES "users" \("id"\)/);
  assert.match(sql, /FOREIGN KEY \("right_id"\) REFERENCES "orders" \("id"\)/);
});
