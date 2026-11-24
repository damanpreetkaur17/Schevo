import { canonicalizeSchema, constraintsOfType } from "./model.js";
import { REFERENTIAL_ACTIONS, typeSql } from "./types.js";
import { quoteIdent } from "./resolve.js";

const INDEX_METHODS = new Set(["btree", "hash", "gist", "spgist", "gin", "brin"]);

function generatedName(prefix, table, ids) {
  const name = `${prefix}_${table.name}_${ids.join("_")}`.replace(/[^A-Za-z0-9_]/g, "_");
  return name.slice(0, 63);
}

function nameOf(constraint, prefix, table) {
  return quoteIdent(constraint.name || generatedName(prefix, table, constraint.columns));
}

function keySql(table, columns) {
  return columns.map((id) => table.columns.find((column) => column.id === id)).filter(Boolean).map((column) => quoteIdent(column.name)).join(", ");
}

function deferrability(constraint) {
  if (!constraint.deferrable) return "";
  return ` DEFERRABLE INITIALLY ${constraint.initiallyDeferred ? "DEFERRED" : "IMMEDIATE"}`;
}

export function schemaToSql(input) {
  const schema = canonicalizeSchema(input);
  const statements = [];

  schema.tables.forEach((table) => {
    const definitions = table.columns.map((column) => {
      const parts = [`  ${quoteIdent(column.name)} ${typeSql(column.type)}`];
      if (column.identity) parts.push(`GENERATED ${column.identity.mode === "ALWAYS" ? "ALWAYS" : "BY DEFAULT"} AS IDENTITY`);
      else if (column.uuidGeneration === "gen_random_uuid" || column.uuidGenerate) parts.push("DEFAULT gen_random_uuid()");
      else if (column.uuidGeneration === "uuid_generate_v4") parts.push("DEFAULT uuid_generate_v4()");
      else if (column.defaultExpression || column.defaultValue) parts.push(`DEFAULT ${column.defaultExpression || column.defaultValue}`);
      const primary = constraintsOfType(table, "primaryKey").some((constraint) => constraint.columns.includes(column.id));
      if (primary || !column.nullable) parts.push("NOT NULL");
      return parts.join(" ");
    });
    const constraints = [];
    constraintsOfType(table, "primaryKey").forEach((constraint) => {
      constraints.push(`  CONSTRAINT ${nameOf(constraint, "pk", table)} PRIMARY KEY (${keySql(table, constraint.columns)})${deferrability(constraint)}`);
    });
    constraintsOfType(table, "unique").forEach((constraint) => {
      const nulls = constraint.nullsNotDistinct ? " NULLS NOT DISTINCT" : "";
      constraints.push(`  CONSTRAINT ${nameOf(constraint, "uq", table)} UNIQUE${nulls} (${keySql(table, constraint.columns)})${deferrability(constraint)}`);
    });
    constraintsOfType(table, "check").forEach((constraint) => {
      constraints.push(`  CONSTRAINT ${nameOf(constraint, "ck", table)} CHECK (${constraint.expression})${deferrability(constraint)}`);
    });
    statements.push(`CREATE TABLE ${quoteIdent(table.name)} (\n${[...definitions, ...constraints].join(",\n")}\n);`);
  });

  schema.tables.forEach((table) => {
    constraintsOfType(table, "foreignKey").forEach((constraint) => {
      const referenced = schema.tables.find((item) => item.id === constraint.referencedTableId);
      if (!referenced) return;
      const onDelete = REFERENTIAL_ACTIONS.includes(constraint.onDelete) ? constraint.onDelete : "NO ACTION";
      const onUpdate = REFERENTIAL_ACTIONS.includes(constraint.onUpdate) ? constraint.onUpdate : "NO ACTION";
      statements.push(
        `ALTER TABLE ${quoteIdent(table.name)} ADD CONSTRAINT ${nameOf(constraint, "fk", table)} FOREIGN KEY (${keySql(table, constraint.columns)}) REFERENCES ${quoteIdent(referenced.name)} (${keySql(referenced, constraint.referencedColumns || [])}) ON DELETE ${onDelete} ON UPDATE ${onUpdate}${deferrability(constraint)};`,
      );
    });
    table.indexes.forEach((index) => {
      if (!INDEX_METHODS.has(index.method)) return;
      const indexName = quoteIdent(index.name || generatedName(index.unique ? "uq_idx" : "idx", table, index.columns));
      const include = index.options?.include?.length ? ` INCLUDE (${keySql(table, index.options.include)})` : "";
      const where = index.options?.where ? ` WHERE ${index.options.where}` : "";
      statements.push(`CREATE ${index.unique ? "UNIQUE " : ""}INDEX ${indexName} ON ${quoteIdent(table.name)} USING ${index.method.toUpperCase()} (${keySql(table, index.columns)})${include}${where};`);
    });
  });
  return statements.join("\n\n");
}

export const SQL_SUPPORTED_FEATURES = Object.freeze([
  "tables", "primary keys", "composite primary keys", "unique constraints", "composite unique constraints",
  "NULLS NOT DISTINCT", "foreign keys", "composite foreign keys", "check constraints", "defaults", "identity columns", "UUID defaults (uuid-ossp is required for uuid_generate_v4)",
  "UUID generation", "indexes", "partial indexes", "included index columns", "self references", "referential actions", "deferrable constraints",
]);
