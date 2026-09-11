<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import './cabinet.css'
import './cabinetImmersive.css'
import { categoryColor } from './archiveCategories.js'
import { cabinetLayout } from './cabinetLayout.js'
import ArchiveSearch from './ArchiveSearch.vue'
import CabinetThree from './CabinetThree.vue'

const props = defineProps({ entries: { type: Array, required: true } })
const focus = ref(0)
const extracted = ref(null)
const cabinet = ref(null)
const threeReady = ref(false)
const viewportWidth = ref(1200)
const stageHeight = ref(0)
let stageObserver
const layout = computed(() => cabinetLayout(viewportWidth.value, files.value.length, focus.value, stageHeight.value))
function resizeLayout() { viewportWidth.value = window.innerWidth }
onUnmounted(() => { window.removeEventListener('resize', resizeLayout); stageObserver?.disconnect() })
function pickScene(link) {
  const post = files.value.find(file => file.link === link)
  if (post) pick(post)
}
const files = computed(() => props.entries)
const categories = computed(() => [...new Set(files.value.map(post => post.category))])
onMounted(() => {
  resizeLayout()
  window.addEventListener('resize', resizeLayout)
  stageObserver = new ResizeObserver(([entry]) => { stageHeight.value = entry.contentRect.height })
  stageObserver.observe(cabinet.value.querySelector('.cabinet-stage'))
  const link = new URLSearchParams(location.search).get('file')
  const index = props.entries.findIndex(post => post.link === link)
  if (index >= 0) {
    focus.value = index
    extracted.value = props.entries[index]
  }
})
function selectSearch(post) {
  focus.value = files.value.findIndex(file => file.link === post.link)
  extracted.value = post
}
function pick(post) {
  focus.value = files.value.findIndex(file => file.link === post.link)
  extracted.value = extracted.value?.link === post.link ? null : post
}
function browse(index) {
  focus.value = Math.max(0, Math.min(files.value.length - 1, index))
  extracted.value = null
}
async function returnFile() {
  const id = extracted.value?.id
  extracted.value = null
  await nextTick()
  const button = Array.from(cabinet.value?.querySelectorAll('.cabinet-file-index button') || []).find(element => element.dataset.file === id)
  button?.focus({ preventScroll: true })
}
</script>

<template>
  <section ref="cabinet" class="cabinet" :class="{ 'has-extracted': extracted }" aria-label="交互式文章档案柜" @keydown.esc.stop.prevent="returnFile">
    <h1 class="cabinet-sr-only">ROBIN · 私人档案</h1>
    <ArchiveSearch :entries="files" @pick="selectSearch" />
    <ul class="cabinet-legend" tabindex="0" aria-label="书脊颜色与文章分类">
      <li v-for="category in categories" :key="category"><span class="cabinet-legend-swatch" :style="{ backgroundColor: categoryColor(category) }" aria-hidden="true"></span>{{ category }}</li>
    </ul>
    <div class="cabinet-workspace">
      <div class="cabinet-stage" :class="{ 'three-ready': threeReady }">
        <CabinetThree :files="files" :selected="extracted?.link || null" :focus="focus" @browse="browse((layout.startRow + $event) * layout.columns)" @pick="pickScene" @ready="threeReady = $event" />
        <div v-if="!threeReady" class="cabinet-floor" aria-hidden="true"></div>
        <div v-if="!threeReady" class="cabinet-rack">
          <button v-for="(post, index) in files" :key="post.link" type="button" class="cabinet-file" :class="{ 'is-extracted': extracted?.link === post.link }" :style="{ '--category-color': categoryColor(post.category), '--column': index % layout.columns, '--row': Math.floor(index / layout.columns) - layout.startRow, '--columns': layout.columns, '--rows': layout.visibleRows }" v-show="Math.floor(index / layout.columns) >= layout.startRow && Math.floor(index / layout.columns) < layout.startRow + layout.visibleRows" :data-file="post.id" :aria-label="`${extracted?.link === post.link ? '归还' : '抽取'}档案 ${post.id}：${post.text}`" :aria-pressed="extracted?.link === post.link" aria-controls="cabinet-preview" @click="pick(post)">
            <span class="cabinet-file-lift">
              <span class="cabinet-spine"><span>{{ post.id }}</span><span>{{ post.category }}</span></span>
              <span class="cabinet-sheet">
                <span class="cabinet-cover-title">{{ post.text }}</span>
                <span class="cabinet-sheet-heading"><b>R</b><span>FIELD NOTES<br>{{ post.id }}</span><i></i></span>
                <svg class="cabinet-optics" viewBox="0 0 200 180" fill="none" aria-hidden="true">
                  <path d="M10 90H190M100 0V180" stroke="currentColor" stroke-dasharray="2 5" opacity=".35" />
                  <circle cx="100" cy="90" r="68" stroke="currentColor" />
                  <circle cx="100" cy="90" r="50" stroke="currentColor" stroke-width="12" opacity=".18" />
                  <circle cx="100" cy="90" r="50" stroke="currentColor" />
                  <path d="M100 22A68 68 0 0 1 168 90" stroke="var(--archive-signal)" stroke-width="5" />
                  <path d="M100 58L132 90L100 122L68 90Z" stroke="currentColor" />
                  <path d="M93 90H107M100 83V97" stroke="currentColor" />
                </svg>
                <span class="cabinet-glass" aria-hidden="true"></span>
                <span class="cabinet-sheet-foot"><span>{{ post.category.toUpperCase() }}</span><span class="cabinet-barcode" aria-hidden="true"></span></span>
              </span>
            </span>
          </button>
        </div>
      </div>
      <aside id="cabinet-preview" class="cabinet-preview" aria-label="档案预览">
        <Transition name="cabinet-copy" mode="out-in">
          <div v-if="extracted" :key="extracted.link" class="cabinet-detail">
            <div class="cabinet-detail-top"><span aria-hidden="true">{{ extracted.id }}</span><button type="button" @click="returnFile" aria-label="归还档案">↙</button></div>
            <h2>{{ extracted.text }}</h2>
            <a class="cabinet-read" :href="extracted.link">阅读 <span>↗</span></a>

          </div>
          <div v-else key="idle" class="cabinet-idle">
            <button type="button" class="cabinet-idle-action" @click="pick(files[focus])" :disabled="!files.length">抽取 <span>↗</span></button>
          </div>
        </Transition>
      </aside>
    </div>
    <div class="cabinet-controls">
      <button class="cabinet-turn" type="button" aria-label="上一行档案" :disabled="layout.startRow <= 0" @click="browse((layout.startRow - 1) * layout.columns)">↑</button>
      <div class="cabinet-row-dots" aria-label="档案架位置">
        <button v-for="row in Math.max(1, layout.rows - layout.visibleRows + 1)" :key="row" type="button" :aria-label="`浏览第 ${row} 行起的档案`" :aria-pressed="layout.startRow === row - 1" @click="browse((row - 1) * layout.columns)"><span></span></button>
      </div>
      <button class="cabinet-turn" type="button" aria-label="下一行档案" :disabled="layout.startRow + layout.visibleRows >= layout.rows" @click="browse((layout.startRow + 1) * layout.columns)">↓</button>
      <div class="cabinet-file-index" aria-label="全部档案">
        <button v-for="(post, index) in files" :key="post.link" :data-file="post.id" :title="post.text" :aria-label="`抽取 ${post.id}：${post.text}`" type="button" :aria-pressed="extracted?.link === post.link" aria-controls="cabinet-preview" @focus="browse(index)" @click="pick(post)"><span>{{ post.text }}</span></button>
      </div>
    </div>
  </section>
</template>
