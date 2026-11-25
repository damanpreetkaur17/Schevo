import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createJunctionTable, setForeignKeyColumns } from "../../frontend/src/domain/schema/mutate.js";
import { createSchemaDocument } from "../../frontend/src/domain/schema/model.js";
import { schemaToSql } from "../../frontend/src/domain/schema/sql.js";
import { pool } from "../src/db/pool.js";
import { migrate } from "../src/db/migrate.js";

async function inTemporarySchema(run) {
  const client = await pool.connect();
  const schemaName = `schevo_sql_${randomUUID().replaceAll("-", "").slice(0, 18)}`;
  const quotedSchema = `"${schemaName}"`;
  let transaction = false;
  try {
    await client.query(`CREATE SCHEMA ${quotedSchema}`);
    await client.query("BEGIN");
    transaction = true;
    await client.query(`SET LOCAL search_path TO ${quotedSchema}`);
    await run(client, schemaName);
    await client.query("ROLLBACK");
    transaction = false;
  } catch (error) {
    if (transaction) await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.query(`DROP SCHEMA IF EXISTS ${quotedSchema} CASCADE`);
    client.release();
  }
}

async function expectSqlState(client, sqlState, operation) {
  await client.query("SAVEPOINT expected_sql_error");
  let failure;
  try {
    await operation();
  } catch (error) {
    failure = error;
  }
  await client.query("ROLLBACK TO SAVEPOINT expected_sql_error");
  await client.query("RELEASE SAVEPOINT expected_sql_error");
  assert.ok(failure, `Expected PostgreSQL error ${sqlState}`);
  assert.equal(failure.code, sqlState, failure.message);
}

function accountsAndDependents() {
  let schema = createSchemaDocument({
    tables: [
      {
        id: "accounts", name: "accounts", columns: [
          { id: "account-id", name: "id", type: "uuid", nullable: false, uuidGeneration: "gen_random_uuid" },
          { id: "tenant-id", name: "tenant_id", type: "uuid", nullable: false },
          { id: "handle", name: "handle", type: "text", nullable: false },
          { id: "nullable-a", name: "nullable_a", type: "text" },
          { id: "nullable-b", name: "nullable_b", type: "text" },
          { id: "active", name: "active", type: "boolean", nullable: false, defaultExpression: "true" },
          { id: "metadata", name: "metadata", type: "jsonb", nullable: false, defaultExpression: "'{}'::jsonb" },
          { id: "created-at", name: "created_at", type: "timestamptz", nullable: false, defaultExpression: "now()" },
        ],
        constraints: [
          { id: "accounts-pk", name: "accounts_pk", type: "primaryKey", columns: ["account-id"] },
          { id: "accounts-tenant-handle", name: "accounts_tenant_handle_uq", type: "unique", columns: ["tenant-id", "handle"] },
          { id: "accounts-null-unique", name: "accounts_nullable_uq", type: "unique", columns: ["nullable-a", "nullable-b"], nullsNotDistinct: true },
          { id: "accounts-active-check", name: "accounts_active_ck", type: "check", columns: [], expression: "active IN (true, false)" },
        ],
        indexes: [
          { id: "accounts-metadata-gin", name: "accounts_metadata_gin", columns: ["metadata"], method: "gin" },
          { id: "accounts-active-partial", name: "accounts_active_partial", columns: ["created-at"], method: "btree", options: { where: "active" } },
        ],
      },
      {
        id: "orders", name: "orders", columns: [
          { id: "order-id", name: "id", type: "uuid", nullable: false, uuidGeneration: "gen_random_uuid" },
          { id: "order-sequence", name: "sequence_no", type: "bigint", nullable: false, identity: { mode: "ALWAYS" } },
          { id: "order-tenant", name: "tenant_id", type: "uuid", nullable: false },
          { id: "order-handle", name: "account_handle", type: "text", nullable: false },
          { id: "order-status", name: "status", type: "text", nullable: false, defaultExpression: "'draft'" },
        ],
        constraints: [
          { id: "orders-pk", name: "orders_pk", type: "primaryKey", columns: ["order-id"] },
          { id: "orders-status-check", name: "orders_status_ck", type: "check", columns: [], expression: "status IN ('draft', 'open', 'closed')" },
        ],
        indexes: [],
      },
      {
        id: "profiles", name: "profiles", columns: [
          { id: "profile-id", name: "id", type: "uuid", nullable: false, uuidGeneration: "gen_random_uuid" },
          { id: "profile-account", name: "account_id", type: "uuid", nullable: false },
        ],
        constraints: [{ id: "profiles-pk", type: "primaryKey", columns: ["profile-id"] }],
        indexes: [],
      },
      {
        id: "categories", name: "categories", columns: [
          { id: "category-id", name: "id", type: "uuid", nullable: false, uuidGeneration: "gen_random_uuid" },
          { id: "category-parent", name: "parent_id", type: "uuid", nullable: true },
        ],
        constraints: [{ id: "categories-pk", type: "primaryKey", columns: ["category-id"] }],
        indexes: [],
      },
    ],
  });
  schema = setForeignKeyColumns(schema, {
    tableId: "orders", columns: ["order-tenant", "order-handle"], referencedTableId: "accounts",
    referencedColumns: ["tenant-id", "handle"], name: "orders_account_fk", onDelete: "CASCADE", onUpdate: "CASCADE",
    deferrable: true, initiallyDeferred: true,
  });
  schema = setForeignKeyColumns(schema, {
    tableId: "profiles", columns: ["profile-account"], referencedTableId: "accounts",
    referencedColumns: ["account-id"], name: "profiles_account_fk", onDelete: "CASCADE", cardinality: "one-to-one",
  });
  schema = setForeignKeyColumns(schema, {
    tableId: "categories", columns: ["category-parent"], referencedTableId: "categories",
    referencedColumns: ["category-id"], name: "categories_parent_fk", onDelete: "SET NULL",
  });
  schema = createJunctionTable(schema, {
    leftTableId: "accounts", leftColumns: ["account-id"], rightTableId: "profiles", rightColumns: ["profile-id"], name: "account_profile_links",
  });
  return schema;
}

test.before(async () => migrate());
test.after(async () => pool.end());

test("generated DDL executes and enforces defaults, keys, checks, identity, indexes and actions", async () => {
  const schema = accountsAndDependents();
  await inTemporarySchema(async (client, schemaName) => {
    await client.query(schemaToSql(schema));
    const inserted = await client.query(
      `INSERT INTO accounts (tenant_id, handle, nullable_a, nullable_b) VALUES ($1, $2, 'initial', 'account')
       RETURNING id, active, metadata, created_at`,
      [randomUUID(), "acme"],
    );
    const account = inserted.rows[0];
    assert.match(account.id, /^[0-9a-f-]{36}$/i);
    assert.equal(account.active, true);
    assert.deepEqual(account.metadata, {});
    assert.ok(account.created_at instanceof Date);

    const tenantId = randomUUID();
    const parent = await client.query("INSERT INTO accounts (tenant_id, handle, nullable_a, nullable_b) VALUES ($1, $2, 'parent', 'key') RETURNING id", [tenantId, "primary"]);
    const childOrder = await client.query("INSERT INTO orders (tenant_id, account_handle) VALUES ($1, $2) RETURNING id, sequence_no, status", [tenantId, "future"]);
    await client.query("INSERT INTO accounts (tenant_id, handle, nullable_a, nullable_b) VALUES ($1, $2, 'future', 'key')", [tenantId, "future"]);
    await client.query("SET CONSTRAINTS orders_account_fk IMMEDIATE");
    assert.match(childOrder.rows[0].id, /^[0-9a-f-]{36}$/i);
    assert.equal(Number(childOrder.rows[0].sequence_no), 1);
    assert.equal(childOrder.rows[0].status, "draft");
    await expectSqlState(client, "23503", () => client.query("INSERT INTO orders (tenant_id, account_handle) VALUES ($1, $2)", [tenantId, "missing"]));
    await expectSqlState(client, "428C9", () => client.query("INSERT INTO orders (tenant_id, account_handle, sequence_no) VALUES ($1, $2, 77)", [tenantId, "future"]));
    await expectSqlState(client, "23514", () => client.query("INSERT INTO orders (tenant_id, account_handle, status) VALUES ($1, $2, 'invalid')", [tenantId, "future"]));
    await expectSqlState(client, "23505", () => client.query("INSERT INTO accounts (tenant_id, handle, nullable_a, nullable_b) VALUES ($1, 'duplicate', 'future', 'key')", [tenantId]));
    await client.query("INSERT INTO accounts (tenant_id, handle, nullable_a, nullable_b) VALUES ($1, 'null-first', NULL, NULL)", [randomUUID()]);
    await expectSqlState(client, "23505", () => client.query("INSERT INTO accounts (tenant_id, handle, nullable_a, nullable_b) VALUES ($1, 'null-second', NULL, NULL)", [randomUUID()]));
    await client.query("INSERT INTO accounts (tenant_id, handle, nullable_a, nullable_b) VALUES ($1, 'null-distinct', NULL, 'y')", [randomUUID()]);

    const profile = await client.query("INSERT INTO profiles (account_id) VALUES ($1) RETURNING id", [parent.rows[0].id]);
    await expectSqlState(client, "23505", () => client.query("INSERT INTO profiles (account_id) VALUES ($1)", [parent.rows[0].id]));
    const indexRows = await client.query("SELECT indexname FROM pg_indexes WHERE schemaname = $1", [schemaName]);
    assert.ok(indexRows.rows.some((row) => row.indexname === "accounts_metadata_gin"));
    assert.ok(indexRows.rows.some((row) => row.indexname === "accounts_active_partial"));

    const categoryParent = await client.query("INSERT INTO categories DEFAULT VALUES RETURNING id");
    const categoryChild = await client.query("INSERT INTO categories (parent_id) VALUES ($1) RETURNING id", [categoryParent.rows[0].id]);
    await client.query("DELETE FROM categories WHERE id = $1", [categoryParent.rows[0].id]);
    const categoryAfterDelete = await client.query("SELECT parent_id FROM categories WHERE id = $1", [categoryChild.rows[0].id]);
    assert.equal(categoryAfterDelete.rows[0].parent_id, null);

    const link = await client.query(
      "INSERT INTO account_profile_links (left_id, right_id) VALUES ($1, $2)",
      [parent.rows[0].id, profile.rows[0].id],
    );
    assert.equal(link.rowCount, 1);
    await expectSqlState(client, "23505", () => client.query(
      "INSERT INTO account_profile_links (left_id, right_id) VALUES ($1, $2)",
      [parent.rows[0].id, profile.rows[0].id],
    ));
    await client.query("UPDATE accounts SET handle = 'future-updated' WHERE tenant_id = $1 AND handle = 'future'", [tenantId]);
    const cascadedUpdate = await client.query("SELECT account_handle FROM orders WHERE tenant_id = $1", [tenantId]);
    assert.equal(cascadedUpdate.rows[0].account_handle, "future-updated");
    await client.query("DELETE FROM account_profile_links WHERE left_id = $1", [parent.rows[0].id]);
    await client.query("DELETE FROM accounts WHERE tenant_id = $1 AND handle = 'future-updated'", [tenantId]);
    await client.query("DELETE FROM accounts WHERE id = $1", [parent.rows[0].id]);
    const dependents = await client.query("SELECT (SELECT count(*) FROM orders WHERE tenant_id = $1) AS orders, (SELECT count(*) FROM profiles WHERE id = $2) AS profiles", [tenantId, profile.rows[0].id]);
    assert.equal(Number(dependents.rows[0].orders), 0);
    assert.equal(Number(dependents.rows[0].profiles), 0);
  });
});

test("generated DDL handles circular foreign keys and deferred inserts", async () => {
  const schema = createSchemaDocument({
    tables: [
      { id: "a", name: "cycle_a", columns: [{ id: "a-id", name: "id", type: "integer", nullable: false, identity: { mode: "BY DEFAULT" } }, { id: "a-b", name: "b_id", type: "integer", nullable: true }], constraints: [{ id: "a-pk", type: "primaryKey", columns: ["a-id"] }], indexes: [] },
      { id: "b", name: "cycle_b", columns: [{ id: "b-id", name: "id", type: "integer", nullable: false, identity: { mode: "BY DEFAULT" } }, { id: "b-a", name: "a_id", type: "integer", nullable: true }], constraints: [{ id: "b-pk", type: "primaryKey", columns: ["b-id"] }], indexes: [] },
    ],
  });
  let linked = setForeignKeyColumns(schema, { tableId: "a", columns: ["a-b"], referencedTableId: "b", referencedColumns: ["b-id"], name: "cycle_a_b_fk", deferrable: true, initiallyDeferred: true });
  linked = setForeignKeyColumns(linked, { tableId: "b", columns: ["b-a"], referencedTableId: "a", referencedColumns: ["a-id"], name: "cycle_b_a_fk", deferrable: true, initiallyDeferred: true });
  const sql = schemaToSql(linked);
  assert.ok(sql.indexOf("CREATE TABLE \"cycle_a\"") < sql.indexOf("ALTER TABLE \"cycle_a\""));
  await inTemporarySchema(async (client) => {
    await client.query(sql);
    const a = await client.query("INSERT INTO cycle_a (id, b_id) VALUES (1, 2) RETURNING id");
    const b = await client.query("INSERT INTO cycle_b (id, a_id) VALUES (2, $1) RETURNING id", [a.rows[0].id]);
    await client.query("SET CONSTRAINTS ALL IMMEDIATE");
    assert.equal(a.rows[0].id, 1);
    assert.equal(b.rows[0].id, 2);
  });
});

test("PostgreSQL-compatible integer foreign-key types are accepted by the database", async () => {
  let schema = createSchemaDocument({
    tables: [
      { id: "wide", name: "wide_parent", columns: [{ id: "wide-id", name: "id", type: "bigint", nullable: false }], constraints: [{ id: "wide-pk", type: "primaryKey", columns: ["wide-id"] }], indexes: [] },
      { id: "narrow", name: "narrow_child", columns: [{ id: "narrow-id", name: "id", type: "integer", nullable: false }, { id: "narrow-parent", name: "parent_id", type: "integer", nullable: false }], constraints: [{ id: "narrow-pk", type: "primaryKey", columns: ["narrow-id"] }], indexes: [] },
    ],
  });
  schema = setForeignKeyColumns(schema, { tableId: "narrow", columns: ["narrow-parent"], referencedTableId: "wide", referencedColumns: ["wide-id"], name: "narrow_parent_fk" });
  await inTemporarySchema(async (client) => {
    await client.query(schemaToSql(schema));
    await client.query("INSERT INTO wide_parent (id) VALUES (42)");
    await client.query("INSERT INTO narrow_child (id, parent_id) VALUES (1, 42)");
  });
});
