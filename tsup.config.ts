import { defineConfig } from 'tsup'

const shared = {
  target: 'es2022',
  splitting: true,
  sourcemap: false,
  treeshake: true,
  // Keep Thai text as UTF-8 instead of \u escapes, which would make the data chunk about 50% larger.
  esbuildOptions(options: { charset?: string }) {
    options.charset = 'utf8'
  },
} as const
const dtsOptions = { compilerOptions: { ignoreDeprecations: '6.0' } }

export default defineConfig([
  {
    ...shared,
    entry: { index: 'src/index.ts', server: 'src/server/app.ts', cli: 'src/server/cli.ts' },
    format: 'esm',
    dts: { ...dtsOptions, entry: { index: 'src/index.ts', server: 'src/server/app.ts' } },
  },
  {
    ...shared,
    entry: { index: 'src/index.ts', server: 'src/server/app.ts' },
    format: 'cjs',
    dts: dtsOptions,
  },
])
