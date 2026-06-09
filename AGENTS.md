# AGENTS.md

## Project

Personal blog built with VitePress 1.5, deployed to Vercel. Content is in Chinese.

## Commands

```bash
yarn dev      # dev server at localhost, watches docs/
yarn build    # production build → docs/.vitepress/dist/
yarn serve    # preview production build locally
```

Uses **yarn** (lockfile is `yarn.lock`). No lint, typecheck, or test commands exist.

## Structure

- `docs/` — VitePress source root (config, content, theme)
- `docs/.vitepress/config.js` — ESM config: sidebar, site title, social links
- `docs/.vitepress/theme/` — Custom theme extending VitePress default
  - `Layout.vue` — Wraps default layout, injects `Comments.vue` in `#doc-after` slot
  - `Comments.vue` — Giscus comment widget (GitHub Discussions, repo `675076143/blog`)
- `docs/programming/` — Blog posts (`.md` files, Chinese-language technical articles)
- `docs/assets/` — Images referenced by posts

## Adding a New Post

1. Create `docs/programming/<slug>.md`
2. **Manually add** an entry to the `sidebar` array in `docs/.vitepress/config.js` — VitePress does not auto-discover pages
3. Place any images in `docs/assets/` and reference with relative paths

## Conventions

- Config is plain JS (ESM `export default`), not TypeScript
- Theme components use `<script setup>` (Vue 3 Composition API)
- Post filenames are transliterated/pinyin or English slugs (e.g., `ru-he-jia-zai-dong-tai-dai-ma.md`)
- No enforced naming convention for assets in `docs/assets/`

## Vercel Deployment

Build command and output directory are auto-detected by Vercel from the VitePress preset. No custom config needed.
