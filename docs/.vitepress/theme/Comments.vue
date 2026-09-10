<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useData, withBase } from 'vitepress'
import { activeTheme } from './useBlogTheme.js'

const { page, isDark } = useData()
const host = ref(null)
const failed = ref(false)
const archive = computed(() => activeTheme.value === 'archive')
let observer, iframe, mounted = false
function themeName() {
  if (!archive.value) return isDark.value ? 'dark_dimmed' : 'light'
  return new URL(withBase(`/giscus/archive-${isDark.value ? 'dark' : 'light'}.css`), location.origin).href
}
function syncTheme() {
  iframe?.contentWindow?.postMessage({ giscus: { setConfig: {
    theme: themeName(), reactionsEnabled: archive.value ? false : true,
  } } }, 'https://giscus.app')
}
function loadComments() {
  if (!mounted || !host.value) return
  observer?.disconnect()
  iframe?.removeEventListener('load', syncTheme)
  iframe = null
  failed.value = false
  host.value.replaceChildren()
  const script = document.createElement('script')
  script.src = 'https://giscus.app/client.js'
  script.async = true
  script.crossOrigin = 'anonymous'
  const config = {
    repo: '675076143/blog', repoId: 'R_kgDONh_fzQ', category: 'General',
    categoryId: 'DIC_kwDONh_fzc4ClmdA', mapping: 'pathname', strict: '0',
    reactionsEnabled: archive.value ? '0' : '1', emitMetadata: '0',
    inputPosition: 'top', theme: themeName(), lang: 'zh-CN', loading: 'lazy',
  }
  Object.assign(script.dataset, config)
  script.onerror = () => { if (script.parentNode === host.value) failed.value = true }
  observer = new MutationObserver(() => {
    const frame = host.value?.querySelector('iframe.giscus-frame')
    if (!frame) return
    iframe = frame
    iframe.title = '文章留言与补充'
    iframe.addEventListener('load', syncTheme)
    observer.disconnect()
  })
  observer.observe(host.value, { childList: true, subtree: true })
  host.value.appendChild(script)
}
onMounted(() => { mounted = true; loadComments() })
watch(() => page.value.relativePath, loadComments, { flush: 'post' })
watch([isDark, activeTheme], syncTheme)
onUnmounted(() => {
  mounted = false
  observer?.disconnect()
  iframe?.removeEventListener('load', syncTheme)
})
</script>

<template>
  <section :class="{ 'archive-comments': archive }" aria-label="留言与补充">
    <header v-if="archive" class="archive-comments-heading"><div><span>ANNOTATIONS / 档案批注</span><h2>留言与补充</h2></div><span>通过 GitHub 参与讨论</span></header>
    <div ref="host" class="giscus"></div>
    <p v-if="failed" class="comments-error" role="status">评论暂时未能加载。<button type="button" @click="loadComments">重试</button> · <a href="https://github.com/675076143/blog/discussions">前往 GitHub 讨论区 ↗</a></p>
  </section>
</template>

<style scoped>
.archive-comments-heading { display: flex; justify-content: space-between; align-items: end; gap: 18px; padding-bottom: 20px; }
.archive-comments-heading > div > span { font: 11px var(--vp-font-family-mono); color: var(--archive-muted); letter-spacing: .05em; }
.archive-comments-heading h2 { margin-top: 9px; font-size: 22px; line-height: 1.5; font-weight: 500; }
.archive-comments-heading > span { color: var(--archive-muted); font-size: 12px; }
.giscus { min-height: 150px; }
.comments-error { padding: 14px; font-size: 13px; line-height: 1.8; background: var(--vp-c-bg-soft); }
.comments-error button, .comments-error a { color: var(--vp-c-brand-1); text-decoration: underline; }
@media (max-width: 680px) { .archive-comments-heading { align-items: start; flex-direction: column; gap: 8px; } }
</style>
