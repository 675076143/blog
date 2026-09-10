// Both the cabinet and the reader use the same file numbers and ordering.
export function archiveEntries(groups) {
  return groups.flatMap((group, groupIndex) => group.items.map((post, index) => ({
    ...post,
    category: group.text,
    id: `${String(groupIndex + 1).padStart(2, '0')}.${String(index + 1).padStart(2, '0')}`,
  })))
}
