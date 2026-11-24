import { REFERENTIAL_ACTIONS, parseType, supportsIdentity, typesMatch } from "./types.js";
import { canonicalizeSchema, constraintsOfType } from "./model.js";

const INDEX_METHODS = new Set(["btree", "hash", "gist", "spgist", "gin", "brin"]);
const keyOf = (ids) => [...ids].sort().join("\u0000");

function diagnostic(code, severity, message, suggestion, entity, extra = {}) {
  return {
    id: `${code}:${entity?.id || "schema"}`,
    code,
    severity,
    message,
    suggestion: suggestion || "",
    entity: entity || { kind: "schema", id: "schema" },
    ...(entity?.kind === "table" ? { tableId: entity.id } : {}),
    ...(entity?.kind === "column" ? { columnId: entity.id, tableId: entity.tableId } : {}),
    ...(entity?.kind === "constraint" ? { relationshipId: entity.id } : {}),
    ...extra,
  };
}

function uniqueKeySets(table) {
  return [
    ...constraintsOfType(table, "primaryKey"),
    ...constraintsOfType(table, "unique"),
  ].map((constraint) => keyOf(constraint.columns));
}

function validColumns(table, ids) {
  const columns = ids.map((id) => table.columns.find((column) => column.id === id));
  return columns.every(Boolean) ? columns : null;
}

export function validateSchema(input) {
  const schema = canonicalizeSchema(input);
  const problems = [];
  const tableNames = new Map();
  const tableIds = new Set();
  const indexNames = new Map();

  schema.tables.forEach((table) => {
    if (tableIds.has(table.id)) problems.push(diagnostic("table.id.duplicate", "error", `Table ID "${table.id}" is duplicated.`, "Assign each table a stable, unique ID.", { kind: "table", id: table.id }));
    tableIds.add(table.id);
    const name = table.name?.trim() || "";
    if (!name) problems.push(diagnostic("table.name.required", "error", "Table name is required.", "Give the table a name.", { kind: "table", id: table.id }));
    else if (tableNames.has(name)) problems.push(diagnostic("table.name.duplicate", "error", `Table "${name}" is duplicated.`, "Rename one of the tables.", { kind: "table", id: table.id }));
    if (name) tableNames.set(name, table.id);
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) && name) problems.push(diagnostic("table.name.identifier", "warning", `Table "${name}" is not a simple SQL identifier.`, "Consider using letters, numbers and underscores.", { kind: "table", id: table.id }));
    if (new TextEncoder().encode(name).length > 63) problems.push(diagnostic("table.name.length", "error", `Table "${name}" exceeds PostgreSQL's 63-byte identifier limit.`, "Shorten the table name so PostgreSQL does not truncate it.", { kind: "table", id: table.id }));
    if (!table.columns.length) problems.push(diagnostic("table.columns.required", "error", "Add at least one column.", "Add a column before generating SQL.", { kind: "table", id: table.id }));

    const primaryKeys = constraintsOfType(table, "primaryKey");
    if (primaryKeys.length > 1) problems.push(diagnostic("table.pk.multiple", "error", `Table "${table.name}" has more than one primary-key constraint.`, "Keep one primary-key constraint and include all key columns in it.", { kind: "table", id: table.id }));
    if (!primaryKeys.length) problems.push(diagnostic("table.pk.missing", "recommendation", `Table "${table.name}" has no primary key.`, "Add a primary key if rows need a stable identity.", { kind: "table", id: table.id }));

    const columnNames = new Map();
    const columnIds = new Set();
    table.columns.forEach((column) => {
      const entity = { kind: "column", id: column.id, tableId: table.id };
      if (columnIds.has(column.id)) problems.push(diagnostic("column.id.duplicate", "error", `Column ID "${column.id}" is duplicated.`, "Assign each column a stable, unique ID within its table.", entity));
      columnIds.add(column.id);
      if (!column.name?.trim()) problems.push(diagnostic("column.name.required", "error", "Column name is required.", "Give the column a name.", entity));
      else if (columnNames.has(column.name)) problems.push(diagnostic("column.name.duplicate", "error", `Column "${column.name}" is duplicated on "${table.name}".`, "Rename one of the columns.", entity));
      if (column.name) columnNames.set(column.name, column.id);
      if (new TextEncoder().encode(column.name || "").length > 63) problems.push(diagnostic("column.name.length", "error", `Column "${column.name}" exceeds PostgreSQL's 63-byte identifier limit.`, "Shorten the column name so PostgreSQL does not truncate it.", entity));

      const parsed = parseType(column.type);
      if (!parsed.known) problems.push(diagnostic("column.type.unknown", "warning", `Column "${column.name}" uses an unsupported type "${column.type}".`, "Choose a supported PostgreSQL type or verify the custom type manually.", entity));
      if ((parsed.name === "varchar" || parsed.name === "char") && parsed.length != null && parsed.length < 1) problems.push(diagnostic("column.type.length", "error", `Column "${column.name}" needs a positive length.`, "Use a length greater than zero.", entity));
      if (column.identity && !supportsIdentity(column.type)) problems.push(diagnostic("column.identity.type", "error", `Identity is only valid for smallint, integer or bigint. "${column.name}" is ${parsed.name}.`, "Change the type or remove identity generation.", entity));
      if (column.identity && column.defaultExpression) problems.push(diagnostic("column.identity.default", "error", `Column "${column.name}" cannot have both identity and a default expression.`, "Choose identity generation or a default expression.", entity));
      if (column.identity && !["ALWAYS", "BY DEFAULT"].includes(column.identity.mode || "BY DEFAULT")) problems.push(diagnostic("column.identity.mode", "error", `Identity mode on "${column.name}" is not supported.`, "Choose ALWAYS or BY DEFAULT.", entity));
      if (column.uuidGeneration && (parsed.name !== "uuid" || !["gen_random_uuid", "uuid_generate_v4"].includes(column.uuidGeneration))) problems.push(diagnostic("column.uuid.generation", "error", `UUID generation on "${column.name}" requires uuid and a supported generator.`, "Use uuid with gen_random_uuid or uuid_generate_v4, or remove UUID generation.", entity));
      if (column.uuidGeneration && column.defaultExpression) problems.push(diagnostic("column.uuid.default.conflict", "error", `Column "${column.name}" cannot have both UUID generation and a default expression.`, "Choose one default-generation method.", entity));
    });

    const constraintIds = new Set();
    const constraintNames = new Set();
    const duplicateConstraintKeys = new Set();
    table.constraints.forEach((constraint) => {
      const entity = { kind: "constraint", id: constraint.id, tableId: table.id };
      if (constraintIds.has(constraint.id)) problems.push(diagnostic("constraint.id.duplicate", "error", `Constraint ID "${constraint.id}" is duplicated.`, "Assign each constraint a stable, unique ID.", entity));
      constraintIds.add(constraint.id);
      if (constraint.name && constraintNames.has(constraint.name)) problems.push(diagnostic("constraint.name.duplicate", "error", `Constraint name "${constraint.name}" is duplicated on "${table.name}".`, "Use a different constraint name.", entity));
      if (constraint.name) constraintNames.add(constraint.name);
      if (new TextEncoder().encode(constraint.name || "").length > 63) problems.push(diagnostic("constraint.name.length", "error", `Constraint name "${constraint.name}" exceeds PostgreSQL's 63-byte limit.`, "Shorten the constraint name.", entity));
      if (constraint.initiallyDeferred && !constraint.deferrable) problems.push(diagnostic("constraint.defer.conflict", "error", "INITIALLY DEFERRED requires a DEFERRABLE constraint.", "Enable deferrability or use INITIALLY IMMEDIATE.", entity));
      const columns = validColumns(table, constraint.columns || []);
      const isCheck = constraint.type === "check";
      if (!columns || (!columns.length && !isCheck)) {
        problems.push(diagnostic("constraint.columns.invalid", "error", `${constraint.type} constraint references missing or empty columns.`, "Select existing columns for the constraint.", entity));
        return;
      }
      if (new Set(constraint.columns).size !== constraint.columns.length) problems.push(diagnostic("constraint.columns.duplicate", "error", "A constraint cannot list the same column more than once.", "Remove duplicate column references.", entity));

      if (["primaryKey", "unique"].includes(constraint.type)) {
        const key = `${constraint.type}:${keyOf(constraint.columns)}`;
        if (duplicateConstraintKeys.has(key)) problems.push(diagnostic("constraint.duplicate", "error", `Duplicate ${constraint.type} constraint on "${table.name}".`, "Keep one copy of the constraint.", entity));
        duplicateConstraintKeys.add(key);
      }
      if (isCheck && !constraint.expression?.trim()) problems.push(diagnostic("constraint.check.empty", "error", "CHECK constraint needs an expression.", "Enter a PostgreSQL boolean expression.", entity));
      if (isCheck && constraint.deferrable) problems.push(diagnostic("constraint.check.deferrable", "error", "PostgreSQL CHECK constraints cannot be deferrable.", "Remove deferrability from this CHECK constraint.", entity));
      if (constraint.type === "unique" && constraint.nullsNotDistinct && constraint.columns.length === 0) problems.push(diagnostic("constraint.unique.nulls", "error", "NULLS NOT DISTINCT requires a unique key.", "Choose one or more columns.", entity));

      if (constraint.type === "foreignKey") {
        const referencedTable = schema.tables.find((item) => item.id === constraint.referencedTableId);
        const referencedColumns = referencedTable && validColumns(referencedTable, constraint.referencedColumns || []);
        if (!referencedTable || !referencedColumns || !referencedColumns.length || referencedColumns.length !== columns.length) {
          problems.push(diagnostic("fk.columns.invalid", "error", "Foreign key columns must match existing columns on both tables and have the same count.", "Select a complete referenced key and the same number of local columns.", entity));
          return;
        }
        const targetKey = keyOf(constraint.referencedColumns);
        if (!uniqueKeySets(referencedTable).includes(targetKey)) problems.push(diagnostic("fk.target.not-unique", "error", `Referenced columns on "${referencedTable.name}" do not match a complete primary or unique key.`, "Reference all columns of a primary-key or unique constraint.", entity));
        columns.forEach((column, index) => {
          if (!typesMatch(column.type, referencedColumns[index].type)) problems.push(diagnostic("fk.type", "error", `Foreign-key type "${column.type}" does not match referenced type "${referencedColumns[index].type}".`, "Use compatible PostgreSQL types in corresponding columns.", { kind: "column", id: column.id, tableId: table.id }, { constraintId: constraint.id }));
        });
        if (!REFERENTIAL_ACTIONS.includes(constraint.onDelete || "NO ACTION") || !REFERENTIAL_ACTIONS.includes(constraint.onUpdate || "NO ACTION")) problems.push(diagnostic("fk.action", "error", "Foreign-key referential action is not supported.", "Choose a supported PostgreSQL referential action.", entity));
        if (["SET NULL"].includes(constraint.onDelete) && columns.some((column) => !column.nullable)) problems.push(diagnostic("fk.set-null.not-null", "error", "ON DELETE SET NULL cannot target NOT NULL referencing columns.", "Allow nulls on all referencing columns or choose another action.", entity));
        if (constraint.onUpdate === "SET NULL" && columns.some((column) => !column.nullable)) problems.push(diagnostic("fk.set-null-update.not-null", "error", "ON UPDATE SET NULL cannot target NOT NULL referencing columns.", "Allow nulls on all referencing columns or choose another action.", entity));
        if (constraint.cardinality === "one-to-one" && !uniqueKeySets(table).includes(keyOf(constraint.columns))) problems.push(diagnostic("fk.one-to-one.unique", "error", "One-to-one requires a unique constraint on all referencing columns.", "Add a matching unique constraint to the referencing columns.", entity));
        if (constraint.cardinality === "many-to-many") problems.push(diagnostic("fk.many-to-many.junction", "error", "A direct foreign key cannot enforce many-to-many cardinality.", "Create a junction table with one foreign key to each endpoint.", entity));
        const duplicateKey = `${keyOf(constraint.columns)}>${constraint.referencedTableId}:${keyOf(constraint.referencedColumns || [])}`;
        if (duplicateConstraintKeys.has(`foreignKey:${duplicateKey}`)) problems.push(diagnostic("fk.duplicate", "error", "Duplicate foreign-key constraint uses the same referencing columns.", "Keep one foreign key or use a distinct set of columns.", entity));
        duplicateConstraintKeys.add(`foreignKey:${duplicateKey}`);
      } else if (!["primaryKey", "unique", "check"].includes(constraint.type)) {
        problems.push(diagnostic("constraint.type.unsupported", "error", `Constraint type "${constraint.type}" is not supported.`, "Choose primaryKey, unique, foreignKey, or check.", entity));
      }
    });

    const indexIds = new Set();
    table.indexes.forEach((index) => {
      const entity = { kind: "index", id: index.id, tableId: table.id };
      if (indexIds.has(index.id)) problems.push(diagnostic("index.id.duplicate", "error", `Index ID "${index.id}" is duplicated.`, "Assign each index a stable, unique ID.", entity));
      indexIds.add(index.id);
      if (!index.columns.length || !validColumns(table, index.columns)) problems.push(diagnostic("index.columns.invalid", "error", `Index "${index.name || index.id}" references missing or empty columns.`, "Select one or more existing columns.", entity));
      if (new Set(index.columns).size !== index.columns.length) problems.push(diagnostic("index.columns.duplicate", "error", "An index cannot list the same key column more than once.", "Remove duplicate indexed columns.", entity));
      if (!INDEX_METHODS.has(index.method)) problems.push(diagnostic("index.method.unsupported", "error", `Index method "${index.method}" is not supported.`, `Choose ${[...INDEX_METHODS].join(", ")}.`, entity));
      if (["hash", "spgist"].includes(index.method) && index.columns.length !== 1) problems.push(diagnostic("index.method.columns", "error", `${index.method} indexes support one key column.`, "Keep one key column or choose a method that supports multiple columns.", entity));
      if (index.options?.include && !validColumns(table, index.options.include)) problems.push(diagnostic("index.include.invalid", "error", `Index "${index.name || index.id}" includes missing columns.`, "Select existing columns for the INCLUDE clause.", entity));
      if (index.options?.include && new Set(index.options.include).size !== index.options.include.length) problems.push(diagnostic("index.include.duplicate", "error", "INCLUDE cannot list a column more than once.", "Remove duplicate included columns.", entity));
      if (index.options?.include?.some((id) => index.columns.includes(id))) problems.push(diagnostic("index.include.key.duplicate", "error", "An index column cannot also appear in INCLUDE.", "Keep each column either as a key or an included column.", entity));
      if (index.options?.include?.length && index.method !== "btree") problems.push(diagnostic("index.include.method", "error", "PostgreSQL INCLUDE columns are supported by B-tree indexes.", "Choose the btree method or remove INCLUDE columns.", entity));
      if (index.unique && index.method !== "btree") problems.push(diagnostic("index.unique.method", "error", "PostgreSQL unique indexes require the btree method.", "Choose btree or make the index non-unique.", entity));
      const unsupportedOptions = Object.keys(index.options || {}).filter((key) => !["include", "where"].includes(key));
      if (unsupportedOptions.length) problems.push(diagnostic("index.options.unsupported", "error", `Index options are not supported: ${unsupportedOptions.join(", ")}.`, "Remove unsupported options; Schevo currently supports INCLUDE and partial-index WHERE expressions.", entity));
      if (index.name && new TextEncoder().encode(index.name).length > 63) problems.push(diagnostic("index.name.length", "error", `Index name "${index.name}" exceeds PostgreSQL's 63-byte limit.`, "Shorten the index name.", entity));
      if (index.name && indexNames.has(index.name)) problems.push(diagnostic("index.name.duplicate", "error", `Index name "${index.name}" is already used by another table in this schema.`, "Use a schema-unique index name.", entity, { conflictingTableId: indexNames.get(index.name) }));
      if (index.name) indexNames.set(index.name, table.id);
    });
  });

  const relationshipIds = new Set();
  const relationshipSignatures = new Set();
  schema.relationships.forEach((relationship) => {
    const entity = { kind: "relationship", id: relationship.id };
    if (relationshipIds.has(relationship.id)) problems.push(diagnostic("relationship.id.duplicate", "error", `Relationship ID "${relationship.id}" is duplicated.`, "Assign each relationship a stable, unique ID.", entity));
    relationshipIds.add(relationship.id);
    const source = schema.tables.find((item) => item.id === relationship.sourceTable);
    const table = schema.tables.find((item) => item.id === relationship.targetTable);
    const sourceColumns = relationship.sourceColumns || [relationship.sourceColumn];
    const targetColumns = relationship.targetColumns || [relationship.targetColumn];
    const sourceValid = source && sourceColumns.length && validColumns(source, sourceColumns);
    const targetValid = table && targetColumns.length && validColumns(table, targetColumns);
    if (!sourceValid || !targetValid || sourceColumns.length !== targetColumns.length) {
      problems.push(diagnostic("relationship.endpoint.missing", "error", "Relationship references a missing table or column, or its composite endpoints have different sizes.", "Select existing columns on both tables and use the same number of columns.", entity));
    }
    const pairs = sourceColumns.map((id, index) => `${id}:${targetColumns[index]}`).sort().join("\u0000");
    const signature = `${relationship.sourceTable}:${relationship.targetTable}:${pairs}`;
    if (relationshipSignatures.has(signature)) problems.push(diagnostic("relationship.duplicate", "error", "The same relationship is defined more than once.", "Keep one relationship definition for these endpoints.", entity));
    relationshipSignatures.add(signature);
    if (!["one-to-one", "one-to-many", "many-to-many"].includes(relationship.cardinality || relationship.kind)) problems.push(diagnostic("relationship.cardinality.invalid", "error", `Relationship cardinality "${relationship.cardinality || relationship.kind}" is not supported.`, "Choose one-to-one, one-to-many, or create a junction table for many-to-many.", entity));
    const constraint = table?.constraints.find((item) => item.id === relationship.constraintId);
    if (!constraint && relationship.cardinality !== "many-to-many") problems.push(diagnostic("relationship.constraint.missing", "error", "Relationship has no matching foreign-key constraint.", "Reconnect the relationship to create its foreign key.", entity));
  });

  return problems;
}

export function validationStatus(problems) {
  if (problems.some((problem) => problem.severity === "error")) return "Errors";
  if (problems.some((problem) => problem.severity === "warning")) return "Warnings";
  if (problems.length) return "Recommendations";
  return "Valid";
}
