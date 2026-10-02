#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { formatAddress, lookupPostcode, parseAddress, search } from '../index'
import { VERSION } from '../version'
import { createApp } from './app'

const HELP = `thai-address-api ${VERSION}

Usage
  thai-address-api [serve] [--port 3000] [--host 0.0.0.0] [--cors <origins>] [--quiet]
  thai-address-api parse "<address>"
  thai-address-api search "<query>" [--limit 10]
  thai-address-api postcode <code>

Options
  -p, --port     Port to listen on (default: $PORT or 3000)
  -H, --host     Interface to bind (default: $HOST or 0.0.0.0)
      --cors     Comma-separated allowed origins (default: *)
  -q, --quiet    Do not log requests
  -l, --limit    Number of search results (default: 10)
  -h, --help     Show this help
  -v, --version  Show the version
`

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    port: { type: 'string', short: 'p' },
    host: { type: 'string', short: 'H' },
    cors: { type: 'string' },
    quiet: { type: 'boolean', short: 'q', default: false },
    limit: { type: 'string', short: 'l' },
    help: { type: 'boolean', short: 'h', default: false },
    version: { type: 'boolean', short: 'v', default: false },
  },
})

const [command = 'serve', ...args] = positionals
const input = args.join(' ')
const print = (value: unknown) => console.log(JSON.stringify(value, null, 2))

function startServer() {
  const port = Number(values.port ?? process.env.PORT ?? 3000)
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    console.error(`Invalid port: ${values.port ?? process.env.PORT}`)
    process.exit(1)
  }
  const hostname = values.host ?? process.env.HOST ?? '0.0.0.0'
  const origins = (values.cors ?? process.env.CORS_ORIGINS)?.split(',').map((o) => o.trim())
  const app = createApp({ cors: origins })
  const root = values.quiet ? app : new Hono().use(logger()).route('/', app)
  const server = serve({ fetch: root.fetch, port, hostname }, (info) => {
    const shown = hostname === '0.0.0.0' ? 'localhost' : hostname
    console.log(`thai-address-api ${VERSION} listening on http://${shown}:${info.port}`)
  })
  const stop = () => server.close(() => process.exit(0))
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
}

if (values.help) console.log(HELP)
else if (values.version) console.log(VERSION)
else if (command === 'serve') startServer()
else if (command === 'parse' && input) {
  const parsed = parseAddress(input)
  print({ ...parsed, formatted: parsed.province ? formatAddress(parsed) : null })
} else if (command === 'search' && input) {
  const limit = values.limit === undefined ? undefined : Number(values.limit)
  for (const r of search(input, { limit })) console.log(`${r.score.toFixed(2)}  ${r.labelTh}  (${r.labelEn})`)
} else if (command === 'postcode' && input) {
  const areas = lookupPostcode(input)
  if (areas.length === 0) {
    console.error(`Postcode ${input} not found`)
    process.exitCode = 1
  }
  for (const a of areas) console.log(formatAddress(a, { style: 'short' }))
} else {
  console.error(HELP)
  process.exitCode = 1
}
