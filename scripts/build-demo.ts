import { rmSync, writeFileSync } from 'node:fs'
import { build } from 'tsup'
import { homePage } from '../src/server/page'

const outDir = 'site'

rmSync(outDir, { recursive: true, force: true })
await build({
  config: false,
  entry: { demo: 'scripts/demo-entry.ts' },
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  outDir,
  outExtension: () => ({ js: '.js' }),
  silent: true,
  esbuildOptions(options) {
    options.charset = 'utf8'
  },
})
writeFileSync(`${outDir}/index.html`, homePage({ standalone: true }))
console.log(`Built ${outDir}/index.html and ${outDir}/demo.js`)
