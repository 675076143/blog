// One palette for the physical file markers, CSS fallback, and legend.
const colors = {
  World: '#ae789b',
  'Self-host': '#b58a43',
  Network: '#528eab',
  Linux: '#6a9569',
  Programming: '#8b80b5',
}
export function categoryColor(category) { return colors[category] || '#84918b' }
