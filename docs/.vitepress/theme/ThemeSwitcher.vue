<script setup>
import { onMounted } from "vue";
import { themes, activeTheme as active, applyTheme, initializeTheme } from './useBlogTheme.js';
onMounted(initializeTheme);
</script>

<template>
  <div class="theme-switcher" aria-label="页面风格">
    <span class="theme-switcher-label">STYLE</span>
    <button
      v-for="theme in themes"
      :key="theme.id"
      type="button"
      :class="['theme-option', `theme-option-${theme.id}`, { active: active === theme.id }]"
      :title="theme.title"
      :aria-label="`切换为 ${theme.title} 风格`"
      :aria-pressed="active === theme.id"
      @click="applyTheme(theme.id)"
    >
      {{ theme.label }}
    </button>
  </div>
</template>
