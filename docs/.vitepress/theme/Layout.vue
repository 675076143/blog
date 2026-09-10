<!--.vitepress/theme/MyLayout.vue-->
<script setup>
import DefaultTheme from "vitepress/theme";
import Comments from "./Comments.vue";
import ThemeSwitcher from "./ThemeSwitcher.vue";
import { defineAsyncComponent } from 'vue';
import { activeTheme } from './useBlogTheme.js';
import ArchiveDocHeader from './ArchiveDocHeader.vue';
import ArchiveReader from './ArchiveReader.vue';
import { useData } from 'vitepress';
const { frontmatter, page } = useData();

const TigaCanvas = defineAsyncComponent(() => import('./TigaCanvas.vue'));

const { Layout } = DefaultTheme;
</script>

<template>
  <ArchiveReader v-if="activeTheme === 'archive' && frontmatter.layout !== false && !page.isNotFound" />
  <Layout v-else>
    <template #doc-before><ArchiveDocHeader /></template>
    <template #doc-after>
      <Comments style="padding-top: 24px" />
    </template>
  </Layout>
  <TigaCanvas v-if="activeTheme === 'tiga' || activeTheme === 'zelda'" />
  <ThemeSwitcher />
</template>
