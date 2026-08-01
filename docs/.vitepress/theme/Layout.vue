<!--.vitepress/theme/MyLayout.vue-->
<script setup>
import DefaultTheme from "vitepress/theme";
import Comments from "./Comments.vue";
import ThemeSwitcher from "./ThemeSwitcher.vue";
import TigaCanvas from "./TigaCanvas.vue";

const { Layout } = DefaultTheme;
</script>

<template>
  <Layout>
    <template #doc-after>
      <Comments style="padding-top: 24px" />
    </template>
  </Layout>
  <TigaCanvas />
  <ThemeSwitcher />
</template>
