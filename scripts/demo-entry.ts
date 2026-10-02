import { listDistricts, listProvinces, listSubDistricts, reverseGeocode, search } from '../src/index'
import { parseWithFormat } from '../src/format'

// Same shape the demo page gets from the HTTP API, so one page script serves both.
;(globalThis as { thaiAddress?: unknown }).thaiAddress = {
  parse: (text: string) => parseWithFormat(text),
  search: (q: string) => search(q, { limit: 8 }),
  provinces: () => listProvinces(),
  districts: (id: string | number) => listDistricts(Number(id)),
  subDistricts: (id: string | number) => listSubDistricts(Number(id)),
  reverse: (lat: number, lng: number) => reverseGeocode(lat, lng),
}
