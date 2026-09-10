import { ref } from 'vue'

export const themes = [
  { id: 'archive', label: '档案', title: '研究档案' },
  { id: 'minecraft', label: 'MC', title: 'Minecraft' },
  { id: 'terminal', label: '>_', title: 'Terminal' },
  { id: 'mario', label: 'M', title: 'Mario' },
  { id: 'zelda', label: 'Z', title: 'Hyrule Adventure' },
  { id: 'tiga', label: 'T', title: 'Tiga Light' },
]

// Server renders the default theme; only the mounted client changes this state.
export const activeTheme = ref('archive')

export function applyTheme(theme) {
  if (!themes.some(({ id }) => id === theme)) return
  activeTheme.value = theme
  document.documentElement.dataset.blogTheme = theme
  try { localStorage.setItem('blog-theme', theme) } catch { /* Storage is optional. */ }
}

export function initializeTheme() {
  applyTheme(document.documentElement.dataset.blogTheme || 'archive')
}
