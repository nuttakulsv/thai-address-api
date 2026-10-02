import { Hono, type Context } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { etag } from 'hono/etag'
import { HTTPException } from 'hono/http-exception'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import {
  DATA_SOURCE,
  getArea,
  getDistrict,
  getProvince,
  listDistricts,
  listProvinces,
  listRegions,
  listSubDistricts,
  lookupPostcode,
  MAX_ADDRESS_LENGTH,
  MAX_QUERY_LENGTH,
  reverseGeocode,
  search,
  type PlaceType,
} from '../index'
import { parseWithFormat } from '../format'
import { VERSION } from '../version'
import { openApiDocument } from './openapi'
import { docsPage, homePage } from './page'

export interface AppOptions {
  /** Allowed CORS origins. Default "*". */
  cors?: string | string[]
  /** Cache-Control max-age in seconds for successful GET responses. Default 86400. */
  maxAge?: number
  /** Serve the demo page at "/" and the API reference at "/docs". Default true. */
  ui?: boolean
}

const ERROR_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  404: 'NOT_FOUND',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  500: 'INTERNAL_ERROR',
}
const PLACE_TYPES: PlaceType[] = ['province', 'district', 'subDistrict']

const fail = (status: ContentfulStatusCode, message: string): never => {
  throw new HTTPException(status, { message })
}

function intParam(value: string | undefined, name: string, min: number, max: number): number | undefined {
  if (value === undefined || value === '') return undefined
  const n = Number(value)
  if (!Number.isInteger(n) || n < min || n > max) fail(400, `${name} must be an integer between ${min} and ${max}`)
  return n
}

function numberParam(value: string | undefined, name: string, min: number, max: number): number {
  const n = Number(value)
  if (value === undefined || value === '' || !Number.isFinite(n) || n < min || n > max) {
    fail(400, `${name} must be a number between ${min} and ${max}`)
  }
  return n
}

function idParam(c: Context, digits: number, name: string): number {
  const raw = c.req.param('id') ?? ''
  if (!new RegExp(`^\\d{${digits}}$`).test(raw)) fail(400, `${name} id must be ${digits} digits`)
  return Number(raw)
}

function textParam(value: unknown, name: string, max: number): string {
  if (typeof value !== 'string' || value.trim() === '') fail(400, `${name} is required`)
  if ((value as string).length > max) fail(400, `${name} must be at most ${max} characters`)
  return value as string
}

export function createApp(options: AppOptions = {}): Hono {
  const { maxAge = 86400, ui = true } = options
  const app = new Hono()

  app.use('*', cors({ origin: options.cors ?? '*', allowMethods: ['GET', 'POST', 'OPTIONS'] }))
  app.use('/v1/*', etag())
  app.use('/openapi.json', etag())
  app.use('*', async (c, next) => {
    await next()
    if (c.req.method === 'GET' && c.res.status === 200 && !c.res.headers.has('Cache-Control')) {
      c.header('Cache-Control', `public, max-age=${maxAge}`)
    }
  })

  app.onError((err, c) => {
    const status = (err instanceof HTTPException ? err.status : 500) as ContentfulStatusCode
    const message = status === 500 ? 'Internal server error' : err.message
    if (status === 500) console.error(err)
    return c.json({ error: { code: ERROR_CODES[status] ?? 'ERROR', message } }, status)
  })
  app.notFound((c) =>
    c.json({ error: { code: 'NOT_FOUND', message: `No route for ${c.req.method} ${c.req.path}` } }, 404),
  )

  app.get('/health', (c) => {
    c.header('Cache-Control', 'no-store')
    return c.json({ status: 'ok', version: VERSION, data: { sha: DATA_SOURCE.sha, date: DATA_SOURCE.date } })
  })

  app.get('/v1/regions', (c) => c.json({ data: listRegions() }))

  app.get('/v1/provinces', (c) => {
    const regionId = intParam(c.req.query('regionId'), 'regionId', 1, 6)
    return c.json({ data: listProvinces(regionId) })
  })

  app.get('/v1/provinces/:id', (c) => {
    const province = getProvince(idParam(c, 2, 'Province')) ?? fail(404, 'Province not found')
    return c.json({ data: province })
  })

  app.get('/v1/provinces/:id/districts', (c) => {
    const id = idParam(c, 2, 'Province')
    if (!getProvince(id)) fail(404, 'Province not found')
    return c.json({ data: listDistricts(id) })
  })

  app.get('/v1/districts/:id', (c) => {
    const district = getDistrict(idParam(c, 4, 'District')) ?? fail(404, 'District not found')
    return c.json({ data: { ...district, province: getProvince(district.provinceId) } })
  })

  app.get('/v1/districts/:id/sub-districts', (c) => {
    const id = idParam(c, 4, 'District')
    if (!getDistrict(id)) fail(404, 'District not found')
    return c.json({ data: listSubDistricts(id) })
  })

  app.get('/v1/sub-districts/:id', (c) => {
    const area = getArea(idParam(c, 6, 'Sub-district')) ?? fail(404, 'Sub-district not found')
    return c.json({ data: area })
  })

  app.get('/v1/postcodes/:code', (c) => {
    const code = c.req.param('code')
    if (!/^\d{5}$/.test(code)) fail(400, 'Postcode must be 5 digits')
    const areas = lookupPostcode(code)
    if (areas.length === 0) fail(404, `Postcode ${code} not found`)
    return c.json({ data: areas })
  })

  app.get('/v1/search', (c) => {
    const q = textParam(c.req.query('q'), 'q', MAX_QUERY_LENGTH)
    const typeParam = c.req.query('type')
    const type = typeParam?.split(',').map((t) => t.trim()) as PlaceType[] | undefined
    if (type?.some((t) => !PLACE_TYPES.includes(t))) fail(400, `type must be one of ${PLACE_TYPES.join(', ')}`)
    const results = search(q, {
      type,
      limit: intParam(c.req.query('limit'), 'limit', 1, 50),
      provinceId: intParam(c.req.query('provinceId'), 'provinceId', 10, 99),
      districtId: intParam(c.req.query('districtId'), 'districtId', 1000, 9999),
    })
    return c.json({ data: results })
  })

  app.get('/v1/parse', (c) =>
    c.json({ data: parseWithFormat(textParam(c.req.query('text'), 'text', MAX_ADDRESS_LENGTH)) }),
  )

  app.post(
    '/v1/parse',
    bodyLimit({ maxSize: 8 * 1024, onError: () => fail(413, 'Request body is larger than 8 KB') }),
    async (c) => {
      if (!c.req.header('content-type')?.includes('application/json')) fail(415, 'Send JSON: {"text": "..."}')
      const body = await c.req.json().catch(() => fail(400, 'Body is not valid JSON'))
      const text = textParam((body as { text?: unknown } | null)?.text, 'text', MAX_ADDRESS_LENGTH)
      return c.json({ data: parseWithFormat(text) })
    },
  )

  app.get('/v1/reverse', (c) => {
    const lat = numberParam(c.req.query('lat'), 'lat', -90, 90)
    const lng = numberParam(c.req.query('lng'), 'lng', -180, 180)
    const limit = intParam(c.req.query('limit'), 'limit', 1, 20)
    const maxKm = c.req.query('maxKm') === undefined ? undefined : numberParam(c.req.query('maxKm'), 'maxKm', 0.1, 200)
    const areas = reverseGeocode(lat, lng, { limit, maxDistanceKm: maxKm })
    if (areas.length === 0) fail(404, 'No sub-district centre within range')
    return c.json({ data: areas })
  })

  app.get('/openapi.json', (c) => c.json(openApiDocument(new URL(c.req.url).origin)))

  if (ui) {
    app.get('/', (c) => {
      c.header('Cache-Control', 'public, max-age=3600')
      return c.html(homePage())
    })
    app.get('/docs', (c) => {
      c.header('Cache-Control', 'public, max-age=3600')
      return c.html(docsPage())
    })
  }

  return app
}
