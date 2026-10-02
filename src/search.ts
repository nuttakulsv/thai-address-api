import { db, type Indexed } from './db'
import { formatAddress } from './format'
import { PROVINCE_ALIASES, prefixScore, toQuery, type Query } from './match'
import { normalize } from './text'
import type { District, PlaceType, Province, SubDistrict } from './types'

export interface SearchOptions {
  /** Restrict results to one or more levels. Default: all three. */
  type?: PlaceType | PlaceType[]
  /** Default 10, max 50. */
  limit?: number
  provinceId?: number
  districtId?: number
}

export interface SearchResult {
  type: PlaceType
  id: number
  nameTh: string
  nameEn: string
  /** Ready-to-display Thai label, e.g. "ต.บางพลีใหญ่ อ.บางพลี จ.สมุทรปราการ 10540". */
  labelTh: string
  labelEn: string
  score: number
  province: Province
  district?: District
  subDistrict?: SubDistrict
}

const TYPE_BOOST: Record<PlaceType, number> = { province: 0.02, district: 0.01, subDistrict: 0 }
const TYPE_ORDER: Record<PlaceType, number> = { province: 0, district: 1, subDistrict: 2 }
export const MAX_QUERY_LENGTH = 100

function scoresFor<T extends { id: number }>(tokens: Query[], list: Indexed<T>[], aliases?: Record<number, string[]>) {
  return tokens.map((t) => {
    const out = new Map<number, number>()
    for (const { item, keys } of list) {
      const s = prefixScore(t, keys, aliases?.[item.id])
      if (s > 0) out.set(item.id, s)
    }
    return out
  })
}

/**
 * Autocomplete over provinces, districts and sub-districts in Thai or English.
 * Extra words narrow the result by parent area or postcode: "หนองบัว ขอนแก่น", "bang phli 10540".
 */
export function search(query: string, options: SearchOptions = {}): SearchResult[] {
  const limit = Math.min(Math.max(Math.trunc(options.limit ?? 10), 1), 50)
  const types = new Set<PlaceType>(
    options.type
      ? Array.isArray(options.type)
        ? options.type
        : [options.type]
      : ['province', 'district', 'subDistrict'],
  )
  const tokens = normalize(query.slice(0, MAX_QUERY_LENGTH))
    .split(/[\s,]+/)
    .map(toQuery)
    .filter((t) => t.key)
    .slice(0, 5)
  if (tokens.length === 0) return []

  const d = db()
  const province = scoresFor(tokens, d.provinces, PROVINCE_ALIASES)
  const district = scoresFor(tokens, d.districts)
  const sub = types.has('subDistrict') ? scoresFor(tokens, d.subDistricts) : []

  // Every token has to match the place itself or one of its parents, and at least one token
  // has to match the place itself. The best own match decides the rank.
  const combine = (own: number[], parent: (i: number) => number): number => {
    let best = -1
    for (let i = 0; i < tokens.length; i++) if (own[i]! > (best < 0 ? 0 : own[best]!)) best = i
    if (best < 0) return 0
    let rest = 0
    for (let i = 0; i < tokens.length; i++) {
      if (i === best) continue
      const s = Math.max(own[i]!, parent(i))
      if (s === 0) return 0
      rest += s
    }
    return tokens.length === 1 ? own[best]! : own[best]! * 0.8 + (0.2 * rest) / (tokens.length - 1)
  }

  type Hit = Omit<SearchResult, 'labelTh' | 'labelEn'>
  const hits: Hit[] = []
  const add = (type: PlaceType, score: number, fields: Omit<Hit, 'type' | 'score'>) =>
    hits.push({ type, score: Math.round((score + TYPE_BOOST[type]) * 1000) / 1000, ...fields })
  const wanted = (provinceId: number, districtId?: number) =>
    (options.provinceId === undefined || options.provinceId === provinceId) &&
    (options.districtId === undefined || options.districtId === districtId)

  if (types.has('province') && options.districtId === undefined) {
    for (const { item } of d.provinces) {
      if (!wanted(item.id)) continue
      const s = combine(
        province.map((m) => m.get(item.id) ?? 0),
        () => 0,
      )
      if (s > 0) add('province', s, { id: item.id, nameTh: item.nameTh, nameEn: item.nameEn, province: item })
    }
  }
  if (types.has('district')) {
    for (const { item } of d.districts) {
      if (!wanted(item.provinceId, item.id)) continue
      const s = combine(
        district.map((m) => m.get(item.id) ?? 0),
        (i) => province[i]!.get(item.provinceId) ?? 0,
      )
      if (s > 0) {
        const p = d.province.get(item.provinceId)!
        add('district', s, { id: item.id, nameTh: item.nameTh, nameEn: item.nameEn, province: p, district: item })
      }
    }
  }
  if (types.has('subDistrict')) {
    d.subDistricts.forEach(({ item }) => {
      if (!wanted(item.provinceId, item.districtId)) return
      const own = tokens.map((t, i) =>
        t.digits ? (item.postcode.startsWith(t.key) ? 0.85 : 0) : (sub[i]!.get(item.id) ?? 0),
      )
      const s = combine(own, (i) =>
        Math.max(district[i]!.get(item.districtId) ?? 0, province[i]!.get(item.provinceId) ?? 0),
      )
      if (s > 0) {
        add('subDistrict', s, {
          id: item.id,
          nameTh: item.nameTh,
          nameEn: item.nameEn,
          province: d.province.get(item.provinceId)!,
          district: d.district.get(item.districtId)!,
          subDistrict: item,
        })
      }
    })
  }

  return hits
    .sort((a, b) => b.score - a.score || TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || a.nameTh.length - b.nameTh.length)
    .slice(0, limit)
    .map((hit) => {
      const input = { subDistrict: hit.subDistrict, district: hit.district, province: hit.province }
      return {
        ...hit,
        labelTh: formatAddress(input, { style: 'short' }),
        labelEn: formatAddress(input, { lang: 'en' }),
      }
    })
}
