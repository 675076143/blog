<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
const props = defineProps({ entries: { type: Array, required: true } })
const emit = defineEmits(['pick'])
const query = ref('')
const open = ref(false)
const active = ref(0)
const root = ref(null)
function outside(event) { if (!root.value?.contains(event.target)) open.value = false }
onMounted(() => document.addEventListener('pointerdown', outside))
onUnmounted(() => document.removeEventListener('pointerdown', outside))
function confirm(event) {
  if (event.isComposing) return
  event.preventDefault()
  select(matches.value[active.value])
}
const matches = computed(() => {
  const terms = query.value.normalize('NFKC').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  return terms.length ? props.entries.filter(post => {
    const text = `${post.text} ${post.category} ${post.id}`.normalize('NFKC').toLocaleLowerCase()
    return terms.every(term => text.includes(term))
  }) : []
})
const expanded = computed(() => open.value && !!query.value.trim())
watch(query, () => { active.value = 0; open.value = true })
async function move(direction) {
  open.value = true
  active.value = Math.max(0, Math.min(matches.value.length - 1, active.value + direction))
  await nextTick()
  root.value?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
}
function select(post) {
  if (!post) return
  emit('pick', post)
  open.value = false
  root.value?.querySelector('input')?.blur()
}
function leave(event) { if (!root.value?.contains(event.relatedTarget)) open.value = false }
</script>

<template>
  <div ref="root" class="archive-search" role="search" @focusout="leave" @keydown.esc.stop.prevent="open = false">
    <span class="archive-search-icon" aria-hidden="true">⌕</span>
    <input v-model="query" type="search" placeholder="搜索档案" aria-label="按标题、分类或编号搜索档案" role="combobox" aria-autocomplete="list" aria-controls="archive-search-results" :aria-expanded="expanded" :aria-activedescendant="expanded && matches.length ? `archive-search-result-${active}` : undefined" autocomplete="off" @focus="open = true" @keydown.down.prevent="move(1)" @keydown.up.prevent="move(-1)" @keydown.enter="confirm">
    <div v-if="expanded" class="archive-search-panel">
      <span class="archive-search-status" role="status">{{ matches.length ? `${matches.length} 篇档案` : '没有找到匹配的档案' }}</span>
      <ul id="archive-search-results" role="listbox" aria-label="搜索结果">
        <li v-for="(post, index) in matches" :id="`archive-search-result-${index}`" :key="post.link" role="option" :aria-selected="active === index" @pointerenter="active = index" @pointerdown.prevent @click="select(post)">
          <span>{{ post.text }}</span><small>{{ post.category }} · {{ post.id }}</small>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.archive-search { position: absolute; z-index: 7; top: max(24px, env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); width: 260px; border: 1px solid var(--glass-edge); border-radius: 6px; background: linear-gradient(120deg, #ffffff24, transparent), color-mix(in srgb, var(--vp-c-bg) 60%, transparent); -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); box-shadow: inset 0 1px 0 #ffffff35; }
.archive-search-icon { position: absolute; left: 12px; top: 6px; font-size: 24px; color: var(--archive-muted); pointer-events: none; }
input { width: 100%; height: 44px; padding: 0 12px 0 38px; font: 13px var(--vp-font-family-base); color: var(--vp-c-text-1); background: transparent; }
input::placeholder { color: var(--archive-muted); }
.archive-search-panel { position: absolute; top: calc(100% + 8px); left: 0; width: max(100%, 340px); max-width: calc(100vw - 32px); max-height: min(360px, 50svh); overflow-y: auto; border: 1px solid var(--glass-edge); border-radius: 6px; background: color-mix(in srgb, var(--vp-c-bg) 94%, transparent); -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px); box-shadow: 0 12px 36px #0002; }
.archive-search-status { display: block; padding: 10px 14px; color: var(--archive-muted); font-size: 11px; }
ul { list-style: none; margin: 0; padding: 0 6px 6px; }
li { padding: 10px 8px; cursor: pointer; min-height: 44px; border-radius: 3px; }
li[aria-selected="true"] { background: var(--vp-c-brand-soft); }
li > span { display: block; font-size: 13px; line-height: 1.5; overflow-wrap: anywhere; }
small { display: block; margin-top: 4px; color: var(--archive-muted); font-size: 10px; }
@media (max-width: 1100px) {
  .archive-search { top: max(68px, calc(env(safe-area-inset-top) + 56px)); left: auto; right: 16px; transform: none; width: min(260px, calc(100% - 32px)); }
  input { height: 38px; }
  .archive-search-icon { top: 3px; }
  .archive-search-panel { left: auto; right: 0; }
}
</style>
