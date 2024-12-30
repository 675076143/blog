<script setup lang="ts">
import { useData } from "vitepress";

const { title } = useData();
</script>

<template>
  <div :key="title" class="giscus">
    <component
      :is="'script'"
      src="https://giscus.app/client.js"
      data-repo="675076143/blog"
      data-repo-id="R_kgDONh_fzQ"
      data-category="General"
      data-category-id="DIC_kwDONh_fzc4ClmdA"
      data-mapping="pathname"
      data-strict="0"
      data-reactions-enabled="1"
      data-emit-metadata="0"
      data-input-position="bottom"
      data-theme="preferred_color_scheme"
      data-lang="zh-CN"
      data-loading="lazy"
      crossorigin="anonymous"
      async
    />
  </div>
</template>