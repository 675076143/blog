<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useData } from 'vitepress'
const props = defineProps({ files: { type: Array, required: true }, selected: { type: String, default: null } })
const emit = defineEmits(['pick', 'ready'])
const { isDark } = useData()
const canvas = ref(null)
let engine, intersection, resizeObserver, preference, stopped = false, visible = true
function syncVisibility() { engine?.setActive(visible && !document.hidden) }
function syncMotion() { engine?.setReducedMotion(preference.matches) }
function fallback() { emit('ready', false); engine?.dispose(); engine = null }
onMounted(async () => {
  try {
    const { createCabinetScene } = await import('./cabinetScene.js')
    if (stopped) return
    engine = createCabinetScene(canvas.value, { onPick: link => emit('pick', link), onFailure: fallback })
    engine.setFiles(props.files)
    engine.setSelected(props.selected)
    engine.setDark(isDark.value)
    preference = matchMedia('(prefers-reduced-motion: reduce)')
    syncMotion()
    preference.addEventListener('change', syncMotion)
    resizeObserver = new ResizeObserver(([entry]) => engine?.resize(entry.contentRect.width, entry.contentRect.height))
    resizeObserver.observe(canvas.value)
    intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; syncVisibility() }, { threshold: .05 })
    intersection.observe(canvas.value)
    document.addEventListener('visibilitychange', syncVisibility)
    const { width, height } = canvas.value.getBoundingClientRect()
    engine.resize(width, height)
    syncVisibility()
    emit('ready', true)
  } catch (error) {
    console.warn('3D archive unavailable; using the accessible CSS cabinet.', error)
    fallback()
  }
})
watch(() => props.files, files => { engine?.setFiles(files); engine?.setSelected(props.selected) })
watch(() => props.selected, link => engine?.setSelected(link))
watch(isDark, value => engine?.setDark(value))
onUnmounted(() => {
  stopped = true
  intersection?.disconnect(); resizeObserver?.disconnect()
  preference?.removeEventListener('change', syncMotion)
  document.removeEventListener('visibilitychange', syncVisibility)
  engine?.dispose()
})
</script>
<template><canvas ref="canvas" class="cabinet-three" aria-hidden="true"></canvas></template>
