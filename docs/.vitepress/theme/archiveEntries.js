// File identifiers stay stable when chronological display order changes.
export function archiveEntries(groups, details = {}) {
  return groups.flatMap((group, groupIndex) => group.items.map((post, index) => ({
    ...post,
    category: group.text,
    date: details[post.link]?.date || '',
    id: `${String(groupIndex + 1).padStart(2, '0')}.${String(index + 1).padStart(2, '0')}`,
  }))).sort((a, b) => {
    const time = post => {
      const timestamp = Date.parse(post.date)
      return Number.isFinite(timestamp) ? timestamp : -Infinity
    }
    const left = time(a), right = time(b)
    return left === right ? 0 : left < right ? 1 : -1
  })
}
