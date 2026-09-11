<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useData } from 'vitepress'
import ArchiveNav from './ArchiveNav.vue'
import Comments from './Comments.vue'
import { data as postDetails } from './archivePosts.data.mjs'
import { archiveEntries } from './archiveEntries.js'
import './reader.css'

const { page, theme } = useData()
const body = ref(null)
const headings = ref([])
const entries = computed(() => archiveEntries(theme.value.sidebar, postDetails))
const path = computed(() => '/' + page.value.relativePath.replace(/\.md$/, ''))
const position = computed(() => entries.value.findIndex(post => post.link === path.value))
const record = computed(() => entries.value[position.value])
const peers = computed(() => entries.value.filter(post => post.category === record.value?.category))
const previous = computed(() => position.value > 0 ? entries.value[position.value - 1] : null)
const next = computed(() => position.value >= 0 ? entries.value[position.value + 1] : null)
const returnUrl = computed(() => record.value ? '/?file=' + encodeURIComponent(record.value.link) : '/')
async function collectHeadings() {
  await nextTick()
  headings.value = Array.from(body.value?.querySelectorAll('.vp-doc h2[id], .vp-doc h3[id]') || []).map(element => ({
    id: element.id, text: element.textContent.replace(/\s*#\s*$/, '').trim(), nested: element.tagName === 'H3',
  }))
}
onMounted(collectHeadings)
watch(() => page.value.relativePath, collectHeadings, { flush: 'post' })
</script>

<template>
  <div class="archive-home archive-reader">
    <a class="archive-skip" href="#reader-content">跳转到档案正文</a>
    <ArchiveNav />
    <div class="reader-toolbar"><a :href="returnUrl">↙ 返回档案柜</a><span>{{ record?.category || 'Profile' }} <span aria-hidden="true">/</span> {{ record ? `FILE ${record.id}` : 'ROBIN' }}</span><span class="reader-mode">READING / 阅览</span></div>
    <div class="reader-workspace">
      <aside class="reader-rail" aria-label="档案导航">
        <div class="reader-file-card" aria-hidden="true">
          <div><b>R</b><span>{{ record?.id || 'R.00' }}</span></div>
          <svg viewBox="0 0 160 140" fill="none"><circle cx="80" cy="70" r="51" stroke="currentColor"/><circle cx="80" cy="70" r="36" stroke="currentColor" stroke-width="9" opacity=".2"/><path d="M80 19A51 51 0 0 1 131 70" stroke="var(--archive-signal)" stroke-width="4"/><path d="M80 45L105 70L80 95L55 70Z" stroke="currentColor"/><path d="M80 0V140M10 70H150" stroke="currentColor" opacity=".2" stroke-dasharray="2 4"/></svg>
          <span>{{ record?.category.toUpperCase() || 'PROFILE' }}</span>
        </div>
        <details class="reader-directory" open>
          <summary>本份档案 <span>{{ String(headings.length).padStart(2, '0') }}</span></summary>
          <nav aria-label="本页目录"><a v-for="heading in headings" :key="heading.id" :href="`#${heading.id}`" :class="{ nested: heading.nested }">{{ heading.text }}</a><span v-if="!headings.length">正文</span></nav>
        </details>
        <details v-if="record" class="reader-directory reader-neighbors">
          <summary>同柜档案 <span>{{ String(peers.length).padStart(2, '0') }}</span></summary>
          <nav aria-label="同分类文章"><a v-for="post in peers" :key="post.link" :href="post.link" :aria-current="post.link === path ? 'page' : undefined"><small>{{ post.id }}</small>{{ post.text }}</a></nav>
        </details>
      </aside>
      <main id="reader-content" ref="body" class="reader-document">
        <div class="reader-document-label"><span>FIELD NOTES / {{ record?.id || 'PROFILE' }}</span><span class="reader-barcode" aria-hidden="true"></span></div>
        <Content class="vp-doc" />
        <p v-if="page.lastUpdated" class="reader-updated">最后更新 / {{ new Date(page.lastUpdated).toISOString().slice(0, 10) }}</p>
        <nav v-if="record" class="reader-pager" aria-label="相邻档案"><a v-if="previous" :href="previous.link"><small>← 上一份 / {{ previous.id }}</small>{{ previous.text }}</a><a v-if="next" :href="next.link"><small>下一份 / {{ next.id }} →</small>{{ next.text }}</a></nav>
        <div class="reader-comments"><Comments /></div>
      </main>
    </div>
    <footer class="archive-footer"><span>ROBIN <span class="archive-footer-slash">/</span> 私人档案</span><a :href="returnUrl">归还档案 ↙</a><a href="#reader-content">返回顶部 ↑</a></footer>
  </div>
</template>
