import { layoutPreview } from "../../domain/schema/layout";

function SchemaThumbnail({ schema, large = false }) {
  const preview = layoutPreview(schema);
  const tables = preview.tables;
  return (
    <svg className={`schema-thumbnail ${large ? "is-large" : ""}`} viewBox={`0 0 ${preview.width} ${preview.height}`} role="img" aria-label="Schema diagram preview">
      <rect width={preview.width} height={preview.height} fill="var(--surface-2)" />
      {schema?.relationships?.map((relationship) => {
        const source = tables.find((table) => table.id === relationship.sourceTable);
        const target = tables.find((table) => table.id === relationship.targetTable);
        if (!source || !target) return null;
        const x1 = source.x + source.width;
        const y1 = source.y + 28;
        const x2 = target.x;
        const y2 = target.y + 28;
        return <path key={relationship.id} d={`M ${x1} ${y1} C ${x1 + 28} ${y1}, ${x2 - 28} ${y2}, ${x2} ${y2}`} fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.55" />;
      })}
      {tables.map((table) => (
        <g key={table.id} transform={`translate(${table.x} ${table.y})`}>
          <rect width={table.width} height={table.height} rx="8" fill="var(--surface)" stroke="currentColor" strokeOpacity="0.28" />
          <rect width={table.width} height="28" rx="8" fill="var(--surface)" stroke="currentColor" strokeOpacity="0.28" />
          <text x="12" y="18" fill="currentColor" fontSize="13" fontFamily="ui-monospace, monospace">{table.name}</text>
          {table.columns.slice(0, 8).map((column, index) => (
            <text key={column.id} x="12" y={46 + index * 18} fill="currentColor" opacity="0.78" fontSize="11" fontFamily="ui-monospace, monospace">
              {column.primaryKey ? "PK " : column.foreignKey ? "FK " : ""}{column.name}  {column.type}
            </text>
          ))}
        </g>
      ))}
    </svg>
  );
}

export default SchemaThumbnail;
