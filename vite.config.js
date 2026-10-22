import { resolve } from 'node:path'
import { defineConfig } from 'vite'

/** Start downloading the WebGL chunk together with the main bundle (home page only). */
function preloadStones() {
  return {
    name: 'preload-stones',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle || !ctx.filename.endsWith(`${resolve(import.meta.dirname, 'index.html')}`)) return html
        const chunk = Object.values(ctx.bundle).find((c) => c.type === 'chunk' && c.name === 'stones')
        if (!chunk) return html
        return {
          html,
          tags: [{ tag: 'link', attrs: { rel: 'modulepreload', crossorigin: true, href: `/${chunk.fileName}` }, injectTo: 'head' }],
        }
      },
    },
  }
}

export default defineConfig({
  plugins: [preloadStones()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 2048,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        impressum: resolve(import.meta.dirname, 'impressum/index.html'),
        notFound: resolve(import.meta.dirname, '404.html'),
      },
    },
  },
  server: { host: true },
})
