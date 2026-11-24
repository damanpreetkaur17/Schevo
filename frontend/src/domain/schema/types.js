const BASE_TYPES = [
  "smallint",
  "integer",
  "bigint",
  "numeric",
  "decimal",
  "real",
  "double precision",
  "boolean",
  "char",
  "varchar",
  "text",
  "uuid",
  "date",
  "time",
  "timestamp",
  "timestamptz",
  "interval",
  "json",
  "jsonb",
  "bytea",
];

export const TYPE_OPTIONS = [
  "uuid",
  "smallint",
  "integer",
  "bigint",
  "numeric",
  "boolean",
  "varchar(255)",
  "text",
  "date",
  "time",
  "timestamp",
  "timestamptz",
  "interval",
  "json",
  "jsonb",
  "bytea",
];

export const REFERENTIAL_ACTIONS = ["NO ACTION", "RESTRICT", "CASCADE", "SET NULL", "SET DEFAULT"];

const INTEGER_TYPES = new Set(["smallint", "integer", "bigint"]);

export function parseType(raw) {
  const value = String(raw || "text").trim().toLowerCase().replace(/\s+/g, " ");
  const match = value.match(/^([a-z ]+?)(?:\(([^)]*)\))?(\[\])?$/);
  const name = match?.[1]?.trim() || value;
  const args = match?.[2]?.split(",").map((part) => part.trim()).filter(Boolean) || [];
  const parsed = { raw: value, name, array: Boolean(match?.[3]), known: BASE_TYPES.includes(name) };
  if (name === "varchar" || name === "char") parsed.length = Number(args[0]) || null;
  if (name === "numeric" || name === "decimal") {
    parsed.precision = Number(args[0]) || null;
    parsed.scale = args[1] != null ? Number(args[1]) : null;
  }
  return parsed;
}

export function typeSql(raw) {
  const parsed = parseType(raw);
  if (!parsed.known) return `"${String(raw || "text").replaceAll('"', '""')}"`;
  let sql = parsed.name.toUpperCase();
  if (parsed.length) sql += `(${parsed.length})`;
  if (parsed.precision) sql += `(${parsed.precision}${parsed.scale != null ? `,${parsed.scale}` : ""})`;
  if (parsed.array) sql += "[]";
  return sql;
}

export function typesMatch(left, right) {
  const a = parseType(left);
  const b = parseType(right);
  if (a.name === b.name && a.array === b.array) return true;
  return !a.array && !b.array && INTEGER_TYPES.has(a.name) && INTEGER_TYPES.has(b.name);
}

export function supportsIdentity(raw) {
  return INTEGER_TYPES.has(parseType(raw).name);
}

export function supportsUuidDefault(raw) {
  return parseType(raw).name === "uuid";
}
