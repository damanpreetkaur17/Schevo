const TABLE_WIDTH = 230;
const TABLE_GAP_X = 70;
const TABLE_GAP_Y = 48;
const TABLE_COLUMNS = 3;
const TABLE_ORIGIN = { x: 80, y: 70 };

function tableHeight(table) {
  return 36 + Math.max(1, table.columns?.length || 0) * 31;
}

function tableCoordinates(table) {
  const x = table.x ?? table.position?.x;
  const y = table.y ?? table.position?.y;
  return Number.isFinite(Number(x)) && Number.isFinite(Number(y))
    ? { x: Number(x), y: Number(y) }
    : null;
}

export function findAvailableTablePosition(tables, tableToPlace) {
  const height = tableHeight(tableToPlace);
  const rowPitch = Math.max(230, ...tables.map((table) => tableHeight(table) + TABLE_GAP_Y), height + TABLE_GAP_Y);
  const positionedTables = tables
    .map((table) => ({ table, position: tableCoordinates(table) }))
    .filter(({ position }) => position);

  for (let index = 0; ; index += 1) {
    const column = index % TABLE_COLUMNS;
    const row = Math.floor(index / TABLE_COLUMNS);
    const candidate = {
      x: TABLE_ORIGIN.x + column * (TABLE_WIDTH + TABLE_GAP_X),
      y: TABLE_ORIGIN.y + row * rowPitch,
    };
    const hasOverlap = positionedTables.some(({ table, position }) => (
      candidate.x < position.x + TABLE_WIDTH
      && candidate.x + TABLE_WIDTH > position.x
      && candidate.y < position.y + tableHeight(table)
      && candidate.y + height > position.y
    ));
    if (!hasOverlap) return candidate;
  }
}

export function layoutPreview(schema) {
  const source = schema?.tables || [];
  let cursorY = 24;
  const columns = 2;
  const cardWidth = 240;
  const gapX = 72;
  const gapY = 36;
  const rowHeights = [];
  const tables = source.map((table, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const height = 32 + Math.min(table.columns.length, 8) * 18 + 12;
    rowHeights[row] = Math.max(rowHeights[row] || 0, height);
    return { ...table, column, row, width: cardWidth, height };
  });
  const rowOffsets = [];
  rowHeights.forEach((height, row) => {
    rowOffsets[row] = cursorY;
    cursorY += height + gapY;
  });
  const placed = tables.map((table) => ({
    ...table,
    x: 24 + table.column * (cardWidth + gapX),
    y: rowOffsets[table.row],
  }));
  const width = Math.max(360, 24 + columns * (cardWidth + gapX));
  const height = Math.max(180, cursorY);
  return { tables: placed, width, height, cardWidth };
}
