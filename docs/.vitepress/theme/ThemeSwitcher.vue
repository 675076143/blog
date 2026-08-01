<script setup>
import { onMounted, ref } from "vue";

const themes = [
  { id: "minecraft", label: "MC", title: "Minecraft" },
  { id: "terminal", label: ">_", title: "Terminal" },
  { id: "mario", label: "M", title: "Mario" },
  { id: "zelda", label: "Z", title: "Hyrule Adventure" },
  { id: "tiga", label: "T", title: "Tiga Light" },
];

const active = ref("minecraft");

function applyTheme(theme) {
  active.value = theme;
  document.documentElement.dataset.blogTheme = theme;
  localStorage.setItem("blog-theme", theme);
}

onMounted(() => {
  const requested = new URLSearchParams(location.search).get("theme");
  const saved = localStorage.getItem("blog-theme");
  const initial = themes.some(({ id }) => id === requested)
    ? requested
    : themes.some(({ id }) => id === saved) ? saved : "minecraft";
  applyTheme(initial);
});
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
