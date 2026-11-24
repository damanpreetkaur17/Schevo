import { parseType } from "./types.js";

export const SCHEMA_VERSION = 2;

const clone = (value) => JSON.parse(JSON.stringify(value));

function stableConstraintId(prefix, tableId, columns) {
  return `${prefix}:${tableId}:${columns.join(":")}`;
}

function canonicalizeTable(table, migrateLegacyFlags) {
  const columns = (table.columns || []).map((column) => {
    const parsed = parseType(column.type);
    return {
      ...column,
      type: column.type || "text",
      dataType: { name: parsed.name, array: parsed.array, length: parsed.length ?? null, precision: parsed.precision ?? null, scale: parsed.scale ?? null, config: column.typeConfig || {} },
      defaultExpression: column.defaultExpression ?? column.defaultValue ?? "",
      identity: column.identity ? (typeof column.identity === "object" ? column.identity : { mode: "BY DEFAULT" }) : null,
      uuidGeneration: column.uuidGeneration || (column.uuidGenerate ? "gen_random_uuid" : null),
      nullable: column.nullable !== false,
      description: column.description || "",
    };
  });
  const constraints = clone(table.constraints || []);
  const existing = new Set(constraints.map((constraint) => `${constraint.type}:${(constraint.columns || []).join(":")}`));
  const primaryColumns = migrateLegacyFlags ? columns.filter((column) => column.primaryKey).map((column) => column.id) : [];
  if (primaryColumns.length && !existing.has(`primaryKey:${primaryColumns.join(":")}`)) {
    constraints.push({ id: stableConstraintId("pk", table.id, primaryColumns), type: "primaryKey", columns: primaryColumns });
  }
  (migrateLegacyFlags ? columns.filter((column) => column.unique && !column.primaryKey) : []).forEach((column) => {
    const ids = [column.id];
    if (!existing.has(`unique:${ids.join(":")}`)) constraints.push({ id: stableConstraintId("uq", table.id, ids), type: "unique", columns: ids });
  });
  const normalizedConstraints = constraints.map((constraint) => ({
    ...constraint,
    id: constraint.id || stableConstraintId(constraint.type, table.id, constraint.columns || []),
    columns: [...(constraint.columns || [])],
    referencedColumns: constraint.referencedColumns ? [...constraint.referencedColumns] : undefined,
    deferrable: Boolean(constraint.deferrable),
    initiallyDeferred: Boolean(constraint.initiallyDeferred),
  }));
  const indexes = (table.indexes || []).map((index, position) => ({
    id: index.id || `index:${table.id}:${position + 1}`,
    name: index.name || "",
    columns: [...(index.columns || [])],
    unique: Boolean(index.unique),
    method: index.method || "btree",
    options: index.options || {},
  }));

  // Keep legacy UI flags derived from the canonical constraint list.
  const pkColumns = new Set(normalizedConstraints.filter((item) => item.type === "primaryKey").flatMap((item) => item.columns));
  const uniqueColumns = new Set(normalizedConstraints.filter((item) => item.type === "unique" && item.columns.length === 1).flatMap((item) => item.columns));
  const foreignKeyColumns = new Set(normalizedConstraints.filter((item) => item.type === "foreignKey").flatMap((item) => item.columns));
  const nextColumns = columns.map((column) => ({
    ...column,
    primaryKey: pkColumns.has(column.id),
    unique: uniqueColumns.has(column.id) || pkColumns.has(column.id),
    nullable: pkColumns.has(column.id) ? false : column.nullable,
    foreignKey: foreignKeyColumns.has(column.id) ? column.foreignKey || true : undefined,
  }));
  return {
    ...table,
    description: table.description || "",
    position: table.position || { x: Number(table.x) || 0, y: Number(table.y) || 0 },
    x: table.position?.x ?? table.x ?? 0,
    y: table.position?.y ?? table.y ?? 0,
    columns: nextColumns,
    constraints: normalizedConstraints,
    indexes,
  };
}

/** Upgrade legacy v1 documents while preserving all user-assigned entity IDs. */
export function canonicalizeSchema(input) {
  const source = input && typeof input === "object" ? clone(input) : {};
  const migrateLegacyFlags = Number(source.schemaVersion || 1) < SCHEMA_VERSION;
  const tables = (source.tables || []).map((table) => canonicalizeTable(table, migrateLegacyFlags));
  const tableByIdOrName = (value) => tables.find((table) => table.id === value || table.name === value);
  const relationships = (source.relationships || []).map((relationship) => {
    const referencedTable = tableByIdOrName(relationship.sourceTable);
    const referencingTable = tableByIdOrName(relationship.targetTable);
    const referencedColumn = referencedTable?.columns.find((column) => column.id === relationship.sourceColumn || column.name === relationship.sourceColumn);
    const referencingColumn = referencingTable?.columns.find((column) => column.id === relationship.targetColumn || column.name === relationship.targetColumn);
    return {
      ...relationship,
      id: relationship.id || `relationship:${referencingTable?.id || "missing"}:${referencingColumn?.id || "missing"}`,
      cardinality: relationship.cardinality || relationship.kind || "one-to-many",
      sourceTable: referencedTable?.id || relationship.sourceTable,
      sourceColumn: referencedColumn?.id || relationship.sourceColumn,
      targetTable: referencingTable?.id || relationship.targetTable,
      targetColumn: referencingColumn?.id || relationship.targetColumn,
    };
  });

  // Legacy relationship edges become table-level foreign-key constraints.
  relationships.forEach((relationship) => {
    const table = tableByIdOrName(relationship.targetTable);
    if (!table) return;
    const columns = relationship.targetColumns || [relationship.targetColumn];
    const referencedColumns = relationship.sourceColumns || [relationship.sourceColumn];
    const id = relationship.constraintId || `fk:${relationship.id}`;
    if (!table.constraints.some((constraint) => constraint.id === id)) {
      table.constraints.push({
        id,
        name: relationship.name || "",
        type: "foreignKey",
        columns,
        referencedTableId: relationship.sourceTable,
        referencedColumns,
        onDelete: relationship.onDelete || "NO ACTION",
        onUpdate: relationship.onUpdate || "NO ACTION",
        deferrable: Boolean(relationship.deferrable),
        initiallyDeferred: Boolean(relationship.initiallyDeferred),
        cardinality: relationship.cardinality,
      });
      relationship.constraintId = id;
    }
  });

  return { schemaVersion: SCHEMA_VERSION, tables, relationships };
}

export function createSchemaDocument({ tables = [], relationships = [] } = {}) {
  return canonicalizeSchema({ schemaVersion: SCHEMA_VERSION, tables, relationships });
}

export function constraintsOfType(table, type) {
  return (table?.constraints || []).filter((constraint) => constraint.type === type);
}
