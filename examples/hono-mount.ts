// Mount the API inside an existing Hono app, without the demo page.
// npx tsx examples/hono-mount.ts   (run `npm run build` first)
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { createApp } from 'thai-address-api/server'

const app = new Hono()
app.get('/', (c) => c.text('my shop'))
app.route('/address', createApp({ ui: false, cors: ['https://shop.example'] }))

serve({ fetch: app.fetch, port: 3001 }, () => console.log('http://localhost:3001/address/v1/provinces'))
