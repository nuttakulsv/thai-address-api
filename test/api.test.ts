import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/server/app'
import { homePage } from '../src/server/page'
import { VERSION } from '../src/version'

const app = createApp()
// oxlint-disable-next-line no-explicit-any
type Json = any
const get = async (path: string, init?: RequestInit): Promise<{ res: Response; body: Json }> => {
  const res = await app.request(path, init)
  return { res, body: res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text() }
}
const post = (path: string, body: unknown, type = 'application/json') =>
  get(path, {
    method: 'POST',
    headers: { 'content-type': type },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

describe('HTTP API', () => {
  it('reports health and the package version', async () => {
    const { res, body } = await get('/health')
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(body).toMatchObject({ status: 'ok', version: VERSION })
    expect(VERSION).toBe(JSON.parse(readFileSync('package.json', 'utf8')).version)
  })

  it('serves the cascading lists', async () => {
    expect((await get('/v1/regions')).body.data).toHaveLength(6)
    expect((await get('/v1/provinces')).body.data).toHaveLength(77)
    expect((await get('/v1/provinces?regionId=6')).body.data.every((p: { regionId: number }) => p.regionId === 6)).toBe(
      true,
    )
    expect((await get('/v1/provinces/11')).body.data.nameTh).toBe('สมุทรปราการ')
    const districts = (await get('/v1/provinces/11/districts')).body.data
    expect(districts.map((d: { nameTh: string }) => d.nameTh)).toContain('บางพลี')
    expect((await get('/v1/districts/1103')).body.data.province.id).toBe(11)
    const subs = (await get('/v1/districts/1103/sub-districts')).body.data
    expect(subs.map((s: { nameTh: string }) => s.nameTh)).toContain('บางพลีใหญ่')
    expect((await get('/v1/sub-districts/110301')).body.data).toMatchObject({
      subDistrict: { postcode: '10540' },
      district: { nameTh: 'บางพลี' },
      province: { nameTh: 'สมุทรปราการ' },
    })
  })

  it('looks up postcodes', async () => {
    expect((await get('/v1/postcodes/10330')).body.data).toHaveLength(4)
    expect((await get('/v1/postcodes/1033')).res.status).toBe(400)
    expect((await get('/v1/postcodes/19999')).res.status).toBe(404)
  })

  it('searches', async () => {
    const { body } = await get(`/v1/search?q=${encodeURIComponent('บางพลีใหน่')}&limit=3`)
    expect(body.data[0]).toMatchObject({ nameTh: 'บางพลีใหญ่', labelTh: 'ต.บางพลีใหญ่ อ.บางพลี จ.สมุทรปราการ 10540' })
    expect(body.data.length).toBeLessThanOrEqual(3)
    const typed = (await get('/v1/search?q=bang&type=province,district')).body.data
    expect(typed.every((r: { type: string }) => r.type !== 'subDistrict')).toBe(true)
  })

  it('parses with GET and POST and adds formatted strings', async () => {
    const text = '99/1ม.4ต.บางพลีใหญ่อ.บางพลีจ.สมุทรปราการ10540'
    const viaGet = (await get(`/v1/parse?text=${encodeURIComponent(text)}`)).body.data
    const viaPost = (await post('/v1/parse', { text })).body.data
    expect(viaPost).toEqual(viaGet)
    expect(viaPost.formatted).toEqual({
      th: '99/1 หมู่ที่ 4 ตำบลบางพลีใหญ่ อำเภอบางพลี จังหวัดสมุทรปราการ 10540',
      en: '99/1 Moo 4, Bang Phli Yai, Bang Phli, Samut Prakan 10540',
    })
    expect((await post('/v1/parse', { text: 'hello' })).body.data.formatted).toBeNull()
  })

  it('reverse geocodes', async () => {
    const { body } = await get('/v1/reverse?lat=13.7466&lng=100.5393&limit=2')
    expect(body.data).toHaveLength(2)
    expect(body.data[0].subDistrict.nameTh).toBe('ปทุมวัน')
    expect((await get('/v1/reverse?lat=35.68&lng=139.69')).res.status).toBe(404)
  })

  it('validates input and answers with one error shape', async () => {
    const cases: [Promise<{ res: Response; body: Json }>, number, string][] = [
      [get('/v1/search'), 400, 'BAD_REQUEST'],
      [get(`/v1/search?q=${'a'.repeat(101)}`), 400, 'BAD_REQUEST'],
      [get('/v1/search?q=a&limit=500'), 400, 'BAD_REQUEST'],
      [get('/v1/search?q=a&type=village'), 400, 'BAD_REQUEST'],
      [get('/v1/provinces/abc'), 400, 'BAD_REQUEST'],
      [get('/v1/provinces/99'), 404, 'NOT_FOUND'],
      [get('/v1/districts/1103/sub-districtz'), 404, 'NOT_FOUND'],
      [get('/v1/reverse?lat=200&lng=100'), 400, 'BAD_REQUEST'],
      [get('/v1/reverse?lat=13'), 400, 'BAD_REQUEST'],
      [get(`/v1/parse?text=${'ก'.repeat(501)}`), 400, 'BAD_REQUEST'],
      [post('/v1/parse', 'text=hello', 'text/plain'), 415, 'UNSUPPORTED_MEDIA_TYPE'],
      [post('/v1/parse', '{not json'), 400, 'BAD_REQUEST'],
      [post('/v1/parse', { text: 42 }), 400, 'BAD_REQUEST'],
      [post('/v1/parse', { text: 'x'.repeat(9000) }), 413, 'PAYLOAD_TOO_LARGE'],
    ]
    for (const [request, status, code] of cases) {
      const { res, body } = await request
      expect(res.status, `${status} ${code}`).toBe(status)
      expect(body.error.code).toBe(code)
      expect(typeof body.error.message).toBe('string')
    }
  })

  it('sends CORS, ETag and cache headers', async () => {
    const { res } = await get('/v1/provinces', { headers: { origin: 'https://shop.example' } })
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(res.headers.get('cache-control')).toBe('public, max-age=86400')
    const tag = res.headers.get('etag')!
    expect(tag).toBeTruthy()
    const again = await app.request('/v1/provinces', { headers: { 'if-none-match': tag } })
    expect(again.status).toBe(304)
  })

  it('limits CORS to configured origins', async () => {
    const strict = createApp({ cors: ['https://shop.example'], maxAge: 60 })
    const ok = await strict.request('/v1/regions', { headers: { origin: 'https://shop.example' } })
    expect(ok.headers.get('access-control-allow-origin')).toBe('https://shop.example')
    expect(ok.headers.get('cache-control')).toBe('public, max-age=60')
    const other = await strict.request('/v1/regions', { headers: { origin: 'https://evil.example' } })
    expect(other.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('publishes an OpenAPI 3.1 document that covers every route', async () => {
    const { body } = await get('/openapi.json')
    expect(body.openapi).toBe('3.1.0')
    for (const path of [
      '/v1/regions',
      '/v1/provinces',
      '/v1/provinces/{id}',
      '/v1/provinces/{id}/districts',
      '/v1/districts/{id}',
      '/v1/districts/{id}/sub-districts',
      '/v1/sub-districts/{id}',
      '/v1/postcodes/{code}',
      '/v1/search',
      '/v1/parse',
      '/v1/reverse',
      '/health',
    ]) {
      expect(body.paths).toHaveProperty([path])
    }
    const refs = JSON.stringify(body).match(/#\/components\/schemas\/\w+/g) ?? []
    for (const ref of refs) expect(body.components.schemas).toHaveProperty([ref.split('/').pop()!])
  })

  it('serves the demo page and docs, and can turn them off', async () => {
    const home = await get('/')
    expect(home.res.status).toBe(200)
    expect(home.body).toContain('<title>Thai Address API</title>')
    expect((await get('/docs')).body).toContain('/openapi.json')
    expect((await createApp({ ui: false }).request('/')).status).toBe(404)
  })

  it('builds a standalone demo page that never calls the API', () => {
    const page = homePage({ standalone: true })
    expect(page).toContain('<script src="demo.js"></script>')
    expect(page).not.toContain('/v1/')
  })
})
