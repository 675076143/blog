<script setup>
import { computed, onMounted, ref } from 'vue'
import ArchiveCabinet from './ArchiveCabinet.vue'
import ArchiveNav from './ArchiveNav.vue'
import { archiveEntries } from './archiveEntries.js'
import { useData } from 'vitepress'
const { theme } = useData()
const selected = ref('All')
const indexDialog = ref(null)
function openIndex() { if (!indexDialog.value.open) indexDialog.value.showModal() }
onMounted(() => { if (location.hash === '#archive-index') openIndex() })
const groups = computed(() => theme.value.sidebar)
const entries = computed(() => archiveEntries(groups.value))
const visibleEntries = computed(() => entries.value.filter(post => selected.value === 'All' || post.category === selected.value))
const descriptions = {
  'Self-host': '本地模型、媒体服务与个人基础设施',
  Network: '连接、协议与网络故障排查',
  Linux: '桌面环境、系统配置与使用记录',
  Programming: '后端工程、性能优化与问题复盘',
}
</script>

<template>
  <div class="archive-home archive-immersive">
    <button class="archive-skip" type="button" @click="openIndex">打开文章索引</button>
    <ArchiveNav overlay @open-index="openIndex" />

    <main id="main-content">
      <ArchiveCabinet :entries="entries" :groups="groups" />

    </main>
    <dialog ref="indexDialog" class="archive-index-dialog" aria-labelledby="archive-index-title" @click="event => { if (event.target === indexDialog) indexDialog.close() }">
      <button type="button" class="archive-index-close" @click="indexDialog.close()" aria-label="关闭文章索引">关闭 ×</button>
      <section id="archive-index" class="archive-index" aria-labelledby="archive-index-title">
        <div class="archive-section-heading"><div><span class="archive-eyebrow">INDEX / 目录</span><h2 id="archive-index-title">研究档案<span> / {{ String(entries.length).padStart(2, '0') }}</span></h2></div><p>从问题出发，沿着线索往下读。</p></div>
        <div class="archive-catalog">
          <nav class="archive-categories" aria-label="按分类筛选文章">
            <span class="archive-category-label">COLLECTIONS</span>
            <button type="button" :class="{ selected: selected === 'All' }" :aria-pressed="selected === 'All'" @click="selected = 'All'">全部档案 <span>{{ String(entries.length).padStart(2, '0') }}</span></button>
            <button v-for="group in groups" :key="group.text" type="button" :class="{ selected: selected === group.text }" :aria-pressed="selected === group.text" @click="selected = group.text">{{ group.text }}<span>{{ String(group.items.length).padStart(2, '0') }}</span></button>
            <p>{{ selected === 'All' ? '关于系统如何运转，\n以及它为什么停止运转。' : descriptions[selected] }}</p>
          </nav>
          <div class="archive-results">
            <div class="archive-list-heading"><span>NO. / TITLE</span><span role="status" aria-live="polite">{{ visibleEntries.length }} 篇记录</span></div>
            <a v-for="post in visibleEntries" :key="post.link" :href="post.link" class="archive-row"><span class="archive-row-id">{{ post.id }}</span><div><span class="archive-row-category">{{ post.category }}</span><h3>{{ post.text }}</h3></div><span class="archive-row-arrow" aria-hidden="true">↗</span></a>
          </div>
        </div>
      </section>
    </dialog>
    <footer class="archive-footer"><span>ROBIN.EXE <span class="archive-footer-slash">/</span> 个人研究档案</span><button type="button" @click="openIndex">全部索引 ↗</button></footer>
  </div>
</template>
