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
