import { DATA_SOURCE } from '../db'
import { MAX_ADDRESS_LENGTH } from '../parse'
import { MAX_QUERY_LENGTH } from '../search'
import { VERSION } from '../version'

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })
const list = (name: string) => ({ type: 'object', properties: { data: { type: 'array', items: ref(name) } } })
const single = (name: string) => ({ type: 'object', properties: { data: ref(name) } })
const json = (schema: object, description = 'OK') => ({ description, content: { 'application/json': { schema } } })
const errors = {
  400: json(ref('Error'), 'Invalid input'),
  404: json(ref('Error'), 'Not found'),
}
const query = (name: string, schema: object, description: string, required = false) => ({
  name,
  in: 'query',
  required,
  description,
  schema,
})
const path = (digits: number, example: number) => ({
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string', pattern: `^\\d{${digits}}$` },
  example: String(example),
})

const nullable = (schema: object) => ({ oneOf: [schema, { type: 'null' }] })
const str = { type: 'string' }
const int = { type: 'integer' }

export function openApiDocument(serverUrl?: string) {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Thai Address API',
      version: VERSION,
      description: `Provinces, districts, sub-districts and postcodes of Thailand, plus free-text address parsing.\n\nData: ${DATA_SOURCE.repo}@${DATA_SOURCE.sha.slice(0, 7)} (${DATA_SOURCE.date.slice(0, 10)}).`,
      license: { name: 'MIT', identifier: 'MIT' },
    },
    servers: serverUrl ? [{ url: serverUrl }] : [],
    tags: [{ name: 'Areas' }, { name: 'Search' }, { name: 'Meta' }],
    paths: {
      '/v1/regions': {
        get: { tags: ['Areas'], summary: 'List the six regions', responses: { 200: json(list('Region')) } },
      },
      '/v1/provinces': {
        get: {
          tags: ['Areas'],
          summary: 'List provinces, sorted by Thai name',
          parameters: [query('regionId', { type: 'integer', minimum: 1, maximum: 6 }, 'Only provinces in this region')],
          responses: { 200: json(list('Province')), 400: errors[400] },
        },
      },
      '/v1/provinces/{id}': {
        get: {
          tags: ['Areas'],
          summary: 'Get a province by its two-digit code',
          parameters: [path(2, 10)],
          responses: { 200: json(single('Province')), ...errors },
        },
      },
      '/v1/provinces/{id}/districts': {
        get: {
          tags: ['Areas'],
          summary: 'Districts (อำเภอ/เขต) in a province',
          parameters: [path(2, 11)],
          responses: { 200: json(list('District')), ...errors },
        },
      },
      '/v1/districts/{id}': {
        get: {
          tags: ['Areas'],
          summary: 'Get a district by its four-digit code',
          parameters: [path(4, 1103)],
          responses: { 200: json(single('DistrictWithProvince')), ...errors },
        },
      },
      '/v1/districts/{id}/sub-districts': {
        get: {
          tags: ['Areas'],
          summary: 'Sub-districts (ตำบล/แขวง) in a district',
          parameters: [path(4, 1103)],
          responses: { 200: json(list('SubDistrict')), ...errors },
        },
      },
      '/v1/sub-districts/{id}': {
        get: {
          tags: ['Areas'],
          summary: 'Get a sub-district with its district and province',
          parameters: [path(6, 110301)],
          responses: { 200: json(single('Area')), ...errors },
        },
      },
      '/v1/postcodes/{code}': {
        get: {
          tags: ['Areas'],
          summary: 'Areas that use a postcode',
          parameters: [
            {
              name: 'code',
              in: 'path',
              required: true,
              schema: { type: 'string', pattern: '^\\d{5}$' },
              example: '10540',
            },
          ],
          responses: { 200: json(list('Area')), ...errors },
        },
      },
      '/v1/search': {
        get: {
          tags: ['Search'],
          summary: 'Autocomplete in Thai or English, typos allowed',
          description:
            'Extra words narrow the result by parent area or postcode, for example `หนองบัว ขอนแก่น` or `bang phli 10540`.',
          parameters: [
            query('q', { type: 'string', maxLength: MAX_QUERY_LENGTH }, 'Search text', true),
            query('type', str, 'Comma-separated: province, district, subDistrict'),
            query('limit', { type: 'integer', minimum: 1, maximum: 50, default: 10 }, 'Maximum results'),
            query('provinceId', int, 'Only inside this province'),
            query('districtId', int, 'Only inside this district'),
          ],
          responses: { 200: json(list('SearchResult')), 400: errors[400] },
        },
      },
      '/v1/parse': {
        get: {
          tags: ['Search'],
          summary: 'Parse a free-text address',
          parameters: [query('text', { type: 'string', maxLength: MAX_ADDRESS_LENGTH }, 'Address text', true)],
          responses: { 200: json(single('ParsedAddress')), 400: errors[400] },
        },
        post: {
          tags: ['Search'],
          summary: 'Parse a free-text address (JSON body)',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['text'],
                  properties: { text: { type: 'string', maxLength: MAX_ADDRESS_LENGTH } },
                },
                example: { text: '99/1 ม.4 ต.บางพลีใหญ่ อ.บางพลี จ.สมุทรปราการ 10540' },
              },
            },
          },
          responses: {
            200: json(single('ParsedAddress')),
            400: errors[400],
            413: json(ref('Error'), 'Body larger than 8 KB'),
            415: json(ref('Error'), 'Body is not JSON'),
          },
        },
      },
      '/v1/reverse': {
        get: {
          tags: ['Search'],
          summary: 'Nearest sub-districts to a coordinate',
          description:
            'Distance is measured to the centre of each sub-district, so results near a boundary are approximate.',
          parameters: [
            query('lat', { type: 'number', minimum: -90, maximum: 90 }, 'Latitude', true),
            query('lng', { type: 'number', minimum: -180, maximum: 180 }, 'Longitude', true),
            query('limit', { type: 'integer', minimum: 1, maximum: 20, default: 1 }, 'Maximum results'),
            query('maxKm', { type: 'number', default: 30 }, 'Ignore centres farther than this'),
          ],
          responses: { 200: json(list('NearbyArea')), ...errors },
        },
      },
      '/health': {
        get: {
          tags: ['Meta'],
          summary: 'Health check',
          responses: {
            200: json({
              type: 'object',
              properties: {
                status: { const: 'ok' },
                version: str,
                data: { type: 'object', properties: { sha: str, date: str } },
              },
            }),
          },
        },
      },
    },
    components: {
      schemas: {
        Region: { type: 'object', properties: { id: int, nameTh: str, nameEn: str } },
        Province: {
          type: 'object',
          properties: { id: { ...int, examples: [10] }, nameTh: str, nameEn: str, regionId: int },
        },
        District: { type: 'object', properties: { id: int, nameTh: str, nameEn: str, provinceId: int } },
        DistrictWithProvince: {
          allOf: [ref('District'), { type: 'object', properties: { province: ref('Province') } }],
        },
        SubDistrict: {
          type: 'object',
          properties: {
            id: int,
            nameTh: str,
            nameEn: str,
            districtId: int,
            provinceId: int,
            postcode: { type: 'string', examples: ['10540'] },
            lat: nullable({ type: 'number' }),
            lng: nullable({ type: 'number' }),
          },
        },
        Area: {
          type: 'object',
          properties: { subDistrict: ref('SubDistrict'), district: ref('District'), province: ref('Province') },
        },
        NearbyArea: { allOf: [ref('Area'), { type: 'object', properties: { distanceKm: { type: 'number' } } }] },
        SearchResult: {
          type: 'object',
          properties: {
            type: { enum: ['province', 'district', 'subDistrict'] },
            id: int,
            nameTh: str,
            nameEn: str,
            labelTh: { type: 'string', examples: ['ต.บางพลีใหญ่ อ.บางพลี จ.สมุทรปราการ 10540'] },
            labelEn: str,
            score: { type: 'number' },
            province: ref('Province'),
            district: ref('District'),
            subDistrict: ref('SubDistrict'),
          },
        },
        ParsedAddress: {
          type: 'object',
          properties: {
            houseNo: nullable(str),
            moo: nullable(str),
            village: nullable(str),
            soi: nullable(str),
            road: nullable(str),
            subDistrict: nullable(ref('SubDistrict')),
            district: nullable(ref('District')),
            province: nullable(ref('Province')),
            postcode: nullable(str),
            phone: nullable(str),
            rest: nullable(str),
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            warnings: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  code: {
                    enum: [
                      'NOT_FOUND',
                      'AMBIGUOUS',
                      'FUZZY_MATCH',
                      'INFERRED',
                      'CONFLICT',
                      'POSTCODE_MISMATCH',
                      'UNKNOWN_POSTCODE',
                    ],
                  },
                  message: str,
                },
              },
            },
            formatted: nullable({
              type: 'object',
              description: 'Clean address strings, only in API responses',
              properties: { th: str, en: str },
            }),
            candidates: {
              type: 'array',
              items: { allOf: [ref('Area'), { type: 'object', properties: { score: { type: 'number' } } }] },
            },
          },
        },
        Error: {
          type: 'object',
          properties: { error: { type: 'object', properties: { code: str, message: str } } },
        },
      },
    },
  }
}
