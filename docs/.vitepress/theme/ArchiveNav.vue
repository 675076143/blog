<script setup>
import { useData } from 'vitepress'
const { isDark } = useData()
const props = defineProps({ overlay: Boolean })
const emit = defineEmits(['open-index'])
function openIndex(event) { if (props.overlay) { event.preventDefault(); emit('open-index') } }
</script>
<template>
  <header class="archive-nav">
    <a class="archive-brand" href="/" aria-label="ROBIN.EXE 首页"><span class="archive-mark" aria-hidden="true">r<span>.</span></span><span>ROBIN.EXE<small>PERSONAL RESEARCH ARCHIVE</small></span></a>
    <nav aria-label="主导航">
      <a class="current" href="/">档案柜 <span>↗</span></a>
      <a href="/#archive-index" @click="openIndex">索引</a>
      <a href="/about">关于</a>
      <a href="https://github.com/675076143">GitHub ↗</a>
      <button class="archive-appearance" type="button" :aria-label="isDark ? '切换为浅色' : '切换为深色'" :aria-pressed="isDark" @click="isDark = !isDark">{{ isDark ? '◐' : '◑' }}</button>
    </nav>
  </header>
</template>
