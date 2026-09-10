import { createContentLoader } from 'vitepress'

export default createContentLoader('programming/*.md', {
  includeSrc: true,
  transform(pages) {
    return Object.fromEntries(pages.map(({ url, src, frontmatter }) => {
      const prose = src.replace(/^---\n[\s\S]*?\n---\n/, '').replace(/```[\s\S]*?```/g, '')
      const paragraph = prose.split(/\n\s*\n/).find(block => {
        const line = block.trim()
        return line && !/^(?:#|>|[-*+]\s|\d+\.|!\[|<|\|)/.test(line)
      }) || ''
      const text = paragraph.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[`*_]/g, '').replace(/\s+/g, ' ').trim()
      return [url, {
        excerpt: text.slice(0, 160) + (text.length > 160 ? '…' : ''),
        date: String(frontmatter.date || prose.match(/^>\s*(\d{4}-\d{2}-\d{2})/m)?.[1] || '').slice(0, 10),
      }]
    }))
  },
})
