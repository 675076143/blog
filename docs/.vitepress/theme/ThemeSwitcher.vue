<script setup>
import { onMounted, ref } from "vue";
import { themes, activeTheme as active, applyTheme, initializeTheme } from './useBlogTheme.js';
onMounted(initializeTheme);
const expanded = ref(false);
</script>

<template>
  <div class="theme-switcher" :class="{ compact: active === 'archive' }" aria-label="页面风格" @keydown.esc="expanded = false">
    <button v-if="active === 'archive'" class="theme-toggle" type="button" :aria-expanded="expanded" aria-controls="theme-options" aria-label="选择页面风格" @click="expanded = !expanded">◈</button>
    <div v-show="active !== 'archive' || expanded" id="theme-options" class="theme-options">
    <span class="theme-switcher-label">STYLE</span>
    <button
      v-for="theme in themes"
      :key="theme.id"
      type="button"
      :class="['theme-option', `theme-option-${theme.id}`, { active: active === theme.id }]"
      :title="theme.title"
      :aria-label="`切换为 ${theme.title} 风格`"
      :aria-pressed="active === theme.id"
      @click="applyTheme(theme.id); expanded = false"
    >
      {{ theme.label }}
    </button>
    </div>
  </div>
</template>

<style scoped>
.theme-options { display: flex; align-items: center; gap: 4px; }
.theme-switcher.compact { border: 0; background: transparent; box-shadow: none; padding: 0; bottom: max(12px, env(safe-area-inset-bottom)); }
.theme-switcher.compact .theme-toggle { width: 44px; height: 44px; font-size: 24px; background: var(--vp-c-bg-elv); border: 1px solid var(--archive-line); }
.compact .theme-options { position: absolute; right: 0; bottom: 54px; display: grid; grid-template-columns: repeat(3, 1fr); padding: 8px; gap: 6px; background: var(--vp-c-bg-elv); border: 1px solid var(--archive-line); box-shadow: 0 10px 30px #0002; }
.compact .theme-switcher-label { display: none; }
.compact .theme-options button { min-width: 58px; min-height: 44px; }
</style>
