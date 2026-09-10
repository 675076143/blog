<script setup>
import { defineAsyncComponent } from 'vue'
import { activeTheme } from './useBlogTheme.js'
import ArchiveHome from './ArchiveHome.vue'
const LegacyHome = defineAsyncComponent(() => import('./LegacyHome.vue'))
</script>

<template>
  <ArchiveHome v-if="activeTheme === 'archive'" />
  <LegacyHome v-else />
</template>
