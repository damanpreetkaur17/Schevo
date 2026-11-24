export function findTable(schema, idOrName) {
  return schema.tables.find((table) => table.id === idOrName || table.name === idOrName) || null;
}

export function findColumn(table, idOrName) {
  if (!table) return null;
  return table.columns.find((column) => column.id === idOrName || column.name === idOrName) || null;
}

export function primaryKeyColumns(table) {
  return table?.columns.filter((column) => column.primaryKey) || [];
}

export function isSolePrimaryKey(table, column) {
  const keys = primaryKeyColumns(table);
  return keys.length === 1 && keys[0].id === column.id;
}

export function columnIsUniqueTarget(table, column) {
  if (!table || !column) return false;
  return Boolean(column.unique) || isSolePrimaryKey(table, column);
}

export function quoteIdent(name) {
  return `"${String(name).replaceAll('"', '""')}"`;
}
