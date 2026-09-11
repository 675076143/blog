export function cabinetLayout(width, count, focus = 0, height = 0) {
  const columns = width <= 680 ? 3 : width <= 1000 ? 5 : 7
  const visibleRows = width <= 680 && height < width * 1.45 ? 2 : 3
  const rows = Math.ceil(count / columns)
  const startRow = Math.max(0, Math.min(Math.floor(focus / columns), rows - visibleRows))
  return { columns, visibleRows, rows, startRow }
}

// Shelves and stored files share the same animated row coordinate.
export function cabinetRowY(row, visibleRows, position) {
  return 1.8 + ((visibleRows - 1) / 2 - (row - position)) * 2.45
}
