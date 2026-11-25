import { findColumn, findTable } from "./resolve.js";
import { canonicalizeSchema } from "./model.js";
import { findAvailableTablePosition } from "./layout.js";

export function relationshipForColumn(schema, tableId, column) {
  return (schema.relationships || []).find((relationship) => {
    if (relationship.targetTable !== tableId) return false;
    const columns = relationship.targetColumns || [relationship.targetColumn];
    return columns.includes(column.id) || columns.includes(column.name);
  }) || null;
}

export function eligibleReferenceKeys(schema, tableId) {
  const normalized = canonicalizeSchema(schema);
  return normalized.tables.flatMap((table) => table.constraints
    .filter((constraint) => ["primaryKey", "unique"].includes(constraint.type))
    .map((constraint) => ({
      tableId: table.id,
      columns: [...constraint.columns],
      label: `${table.name}(${constraint.columns.map((id) => table.columns.find((column) => column.id === id)?.name || id).join(", ")})`,
      sameTable: table.id === tableId,
      constraintId: constraint.id,
    })));
}

export function eligibleReferenceColumns(schema, tableId) {
  return eligibleReferenceKeys(schema, tableId).filter((key) => key.columns.length === 1).map((key) => {
    const table = findTable(schema, key.tableId);
    const column = findColumn(table, key.columns[0]);
    return { ...key, columnId: column?.id, label: `${table?.name}.${column?.name}` };
  });
}

export function setForeignKey(schema, { tableId, columnId, referencedTableId, referencedColumnId, onDelete = "NO ACTION", onUpdate = "NO ACTION", cardinality = "one-to-many" }) {
  return setForeignKeyColumns(schema, { tableId, columns: [columnId], referencedTableId, referencedColumns: [referencedColumnId], onDelete, onUpdate, cardinality });
}

export function setForeignKeyColumns(schema, { tableId, columns, referencedTableId, referencedColumns, onDelete = "NO ACTION", onUpdate = "NO ACTION", cardinality = "one-to-many", name = "", deferrable = false, initiallyDeferred = false }) {
  const next = canonicalizeSchema(schema);
  const table = findTable(next, tableId);
  if (!table || columns.some((id) => !findColumn(table, id))) return next;
  next.relationships = (next.relationships || []).filter((relationship) => {
    return relationship.targetTable !== table.id || !(relationship.targetColumns || [relationship.targetColumn]).some((id) => columns.includes(id));
  });
  table.constraints = table.constraints.filter((constraint) => constraint.type !== "foreignKey" || !constraint.columns.some((id) => columns.includes(id)));
  if (!referencedTableId || !referencedColumns?.length) {
    return next;
  }
  const referencedTable = findTable(next, referencedTableId);
  if (!referencedTable || referencedColumns.some((id) => !findColumn(referencedTable, id)) || columns.length !== referencedColumns.length) return next;
  const relationshipId = `rel-${table.id}-${columns.join("-")}-${referencedTable.id}-${referencedColumns.join("-")}`;
  const constraintId = `fk:${relationshipId}`;
  table.constraints.push({ id: constraintId, name, type: "foreignKey", columns: [...columns], referencedTableId: referencedTable.id, referencedColumns: [...referencedColumns], onDelete, onUpdate, deferrable, initiallyDeferred, cardinality });
  if (cardinality === "one-to-one") {
    const uniqueId = `uq:${table.id}:${columns.join(":")}`;
    if (!table.constraints.some((constraint) => constraint.type === "unique" && constraint.columns.length === columns.length && constraint.columns.every((id, index) => id === columns[index]))) {
      table.constraints.push({ id: uniqueId, type: "unique", columns: [...columns] });
    }
  }
  next.relationships.push({
    id: relationshipId,
    constraintId,
    sourceTable: referencedTable.id,
    sourceColumns: [...referencedColumns],
    sourceColumn: referencedColumns[0],
    targetTable: table.id,
    targetColumns: [...columns],
    targetColumn: columns[0],
    kind: cardinality,
    cardinality,
    name,
    onDelete,
    onUpdate,
    deferrable,
    initiallyDeferred,
  });
  return canonicalizeSchema(next);
}

function generatedId(prefix) {
  const uuid = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${uuid}`;
}

export function createJunctionTable(schema, { leftTableId, leftColumns, rightTableId, rightColumns, name }) {
  const next = canonicalizeSchema(schema);
  const left = findTable(next, leftTableId);
  const right = findTable(next, rightTableId);
  if (!left || !right || !leftColumns?.length || !rightColumns?.length) throw new Error("Choose two existing primary or unique keys for the junction table.");
  const leftKey = left.constraints.find((constraint) => ["primaryKey", "unique"].includes(constraint.type) && constraint.columns.length === leftColumns.length && constraint.columns.every((id, index) => id === leftColumns[index]));
  const rightKey = right.constraints.find((constraint) => ["primaryKey", "unique"].includes(constraint.type) && constraint.columns.length === rightColumns.length && constraint.columns.every((id, index) => id === rightColumns[index]));
  if (!leftKey || !rightKey) throw new Error("Junction endpoints must reference complete primary or unique keys.");

  const tableId = generatedId("junction");
  const tableName = (name || `${left.name}_${right.name}`).trim().replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || "junction_table";
  if (next.tables.some((table) => table.name === tableName)) throw new Error(`A table named "${tableName}" already exists.`);
  const columns = [];
  const makeColumns = (source, ids, side) => ids.map((columnId) => {
    const sourceColumn = findColumn(source, columnId);
    const id = generatedId("column");
    const column = { id, name: `${side}_${sourceColumn.name}`, type: sourceColumn.type, nullable: false, description: "" };
    columns.push(column);
    return id;
  });
  const leftLocal = makeColumns(left, leftColumns, "left");
  const rightLocal = makeColumns(right, rightColumns, "right");
  const junction = {
    id: tableId,
    name: tableName,
    description: `Junction between ${left.name} and ${right.name}.`,
    ...findAvailableTablePosition(next.tables, { columns }),
    columns,
    constraints: [{ id: generatedId("pk"), type: "primaryKey", columns: [...leftLocal, ...rightLocal] }],
    indexes: [],
  };
  next.tables.push(junction);
  let linked = setForeignKeyColumns(next, { tableId, columns: leftLocal, referencedTableId: left.id, referencedColumns: leftColumns });
  linked = setForeignKeyColumns(linked, { tableId, columns: rightLocal, referencedTableId: right.id, referencedColumns: rightColumns });
  return canonicalizeSchema(linked);
}
