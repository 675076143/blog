<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { data as postDetails } from './archivePosts.data.mjs'
import './cabinet.css'

const props = defineProps({ entries: { type: Array, required: true }, groups: { type: Array, required: true } })
const shelf = ref('All')
const page = ref(0)
const extracted = ref(null)
const cabinet = ref(null)
const filtered = computed(() => props.entries.filter(post => shelf.value === 'All' || post.category === shelf.value))
const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / 7)))
const files = computed(() => filtered.value.slice(page.value * 7, page.value * 7 + 7))
const detail = computed(() => postDetails[extracted.value?.link] || {})
onMounted(() => {
  const link = new URLSearchParams(location.search).get('file')
  const index = props.entries.findIndex(post => post.link === link)
  if (index >= 0) {
    page.value = Math.floor(index / 7)
    extracted.value = props.entries[index]
  }
})
function pick(post) { extracted.value = extracted.value?.link === post.link ? null : post }
function changeShelf(value) { shelf.value = value; page.value = 0; extracted.value = null }
function turn(direction) {
  page.value = (page.value + direction + pageCount.value) % pageCount.value
  extracted.value = null
}
async function returnFile() {
  const id = extracted.value?.id
  extracted.value = null
  await nextTick()
  const button = Array.from(cabinet.value?.querySelectorAll('.cabinet-file') || []).find(element => element.dataset.file === id)
  button?.focus({ preventScroll: true })
}
</script>

<template>
  <section ref="cabinet" class="cabinet" :class="{ 'has-extracted': extracted }" aria-label="交互式文章档案柜" @keydown.esc.stop.prevent="returnFile">
    <div class="cabinet-heading">
      <div><span class="archive-eyebrow">ROBIN / RESEARCH COLLECTION</span><h1>记录即是<span>反抗。</span></h1></div>
      <p>麻木不仁的日子里，留下一些线索。<br>Linux、后端工程与自托管实践。</p>
    </div>
    <div class="cabinet-toolbar">
      <nav aria-label="选择档案柜">
        <button type="button" :aria-pressed="shelf === 'All'" @click="changeShelf('All')">全部档案</button>
        <button v-for="group in groups" :key="group.text" type="button" :aria-pressed="shelf === group.text" @click="changeShelf(group.text)">{{ group.text }}</button>
      </nav>
      <span>{{ String(filtered.length).padStart(2, '0') }} FILES</span>
    </div>
    <div class="cabinet-workspace">
      <div class="cabinet-stage">
        <div class="cabinet-coordinates" aria-hidden="true"><span>R / E — {{ String(page + 1).padStart(2, '0') }}</span><span>＋</span></div>
        <div class="cabinet-floor" aria-hidden="true"></div>
        <div class="cabinet-rack">
          <button v-for="(post, index) in files" :key="post.link" type="button" class="cabinet-file" :class="{ 'is-extracted': extracted?.link === post.link }" :style="{ '--slot': index - (files.length - 1) / 2, '--layer': index + 1 }" :data-file="post.id" :aria-label="`${extracted?.link === post.link ? '归还' : '抽取'}档案 ${post.id}：${post.text}`" :aria-pressed="extracted?.link === post.link" aria-controls="cabinet-preview" @click="pick(post)">
            <span class="cabinet-file-lift">
              <span class="cabinet-spine"><span>{{ post.id }}</span><span>{{ post.category }}</span></span>
              <span class="cabinet-sheet">
                <span class="cabinet-sheet-heading"><b>R / E</b><span>FIELD NOTES<br>{{ post.id }}</span><i></i></span>
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
        <div class="cabinet-stage-bottom"><span>{{ extracted ? `FILE ${extracted.id} / 已抽取` : '点击档案抽取 · 再次点击归位' }}</span><span aria-hidden="true">↗</span></div>
      </div>
      <aside id="cabinet-preview" class="cabinet-preview" aria-label="档案预览">
        <Transition name="cabinet-copy" mode="out-in">
          <div v-if="extracted" :key="extracted.link" class="cabinet-detail">
            <div class="cabinet-detail-top"><span>FILE / {{ extracted.id }}</span><button type="button" @click="returnFile" aria-label="归还档案">归位 ↙</button></div>
            <span class="cabinet-detail-category">{{ extracted.category }}</span>
            <h2>{{ extracted.text }}</h2>
            <p>{{ detail.excerpt || '打开完整记录，查看问题的背景、判断过程与最终取舍。' }}</p>
            <span v-if="detail.date" class="cabinet-date">记录日期 / {{ detail.date }}</span>
            <a class="cabinet-read" :href="extracted.link">打开完整记录 <span>↗</span></a>
            <span class="cabinet-detail-hint">ESC 归位 / 点击其他档案切换</span>
          </div>
          <div v-else key="idle" class="cabinet-idle">
            <span class="archive-eyebrow">ARCHIVE / SELECT</span><span class="cabinet-idle-number">{{ String(filtered.length).padStart(2, '0') }}<small>份记录</small></span>
            <h2>每个问题，<br>都有一份档案。</h2>
            <p>从柜中抽取一份记录，<br>沿着当时的线索，重新走一遍。</p>
            <button type="button" class="cabinet-read" @click="pick(files[0])" :disabled="!files.length">抽取第一份 <span>↗</span></button>
            <span class="cabinet-detail-hint">也可以在下方目录直接查阅全文</span>
          </div>
        </Transition>
      </aside>
    </div>
    <div class="cabinet-pagination"><span role="status" aria-live="polite">{{ shelf === 'All' ? '全部档案' : shelf }} · 第 {{ page + 1 }} / {{ pageCount }} 柜</span><div><button type="button" aria-label="上一柜" :disabled="pageCount <= 1" @click="turn(-1)">←</button><button type="button" aria-label="下一柜" :disabled="pageCount <= 1" @click="turn(1)">→</button></div></div>
    <div class="cabinet-file-index" aria-label="本柜档案目录">
      <button v-for="post in files" :key="post.link" type="button" :aria-pressed="extracted?.link === post.link" aria-controls="cabinet-preview" @click="pick(post)"><span>{{ post.id }}</span><span>{{ post.text }}</span><span aria-hidden="true">↗</span></button>
    </div>
  </section>
</template>
