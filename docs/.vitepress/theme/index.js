// .vitepress/theme/index.js
import DefaultTheme from 'vitepress/theme'
import Layout from './Layout.vue'
import './custom.css'
import ThemeSwitcher from './ThemeSwitcher.vue'
import TigaCanvas from './TigaCanvas.vue'

export default {
  extends: DefaultTheme,
  // 使用注入插槽的包装组件覆盖 Layout
  Layout,
  enhanceApp({ app }) {
    app.component('ThemeSwitcher', ThemeSwitcher)
    app.component('TigaCanvas', TigaCanvas)
  }
}
