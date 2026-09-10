<script setup>
import { computed } from 'vue'
import { useData } from 'vitepress'
const { page, theme } = useData()
const section = computed(() => theme.value.sidebar.find(group => group.items.some(item => item.link === '/' + page.value.relativePath.replace(/\.md$/, '')))?.text || 'Profile')
</script>

<template>
  <div class="archive-doc-header">
    <a href="/#archive-index">← 返回档案索引</a>
    <span>FIELD NOTES / {{ section.toUpperCase() }}</span>
  </div>
</template>
