import { build, context } from 'esbuild'
import { argv } from 'process'

const watch = argv.includes('--watch')

const shared = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  external: [
    'electron',
    // keep all native/node built-ins external
    'fs', 'path', 'os', 'crypto', 'url', 'http', 'https',
    'net', 'tls', 'stream', 'zlib', 'events', 'util',
    'buffer', 'assert', 'child_process', 'worker_threads',
  ],
  sourcemap: true,
  logLevel: 'info',
}

const entries = [
  { entryPoints: ['src/main/main.ts'],       outfile: 'dist/main.cjs' },
  { entryPoints: ['src/preload/preload.ts'],  outfile: 'dist/preload.cjs' },
]

if (watch) {
  await Promise.all(
    entries.map(async (opts) => {
      const ctx = await context({ ...shared, ...opts })
      await ctx.watch()
    })
  )
} else {
  await Promise.all(entries.map((opts) => build({ ...shared, ...opts })))
}
