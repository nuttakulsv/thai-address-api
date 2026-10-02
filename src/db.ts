import { DISTRICTS, PROVINCES, REGIONS, SOURCE, SUB_DISTRICTS } from './data/data'
import { toKey, toSkeleton } from './text'
import type { Area, District, Province, Region, SubDistrict } from './types'

export interface Keys {
  th: string
  thSkel: string
  en: string
  enSkel: string
}

export interface Indexed<T> {
  item: T
  keys: Keys
}

export interface Db {
  regions: Region[]
  provinces: Indexed<Province>[]
  districts: Indexed<District>[]
  subDistricts: Indexed<SubDistrict>[]
  province: Map<number, Province>
  district: Map<number, District>
  subDistrict: Map<number, SubDistrict>
  districtsOf: Map<number, District[]>
  subDistrictsOf: Map<number, SubDistrict[]>
  postcode: Map<string, SubDistrict[]>
}

export const BANGKOK_ID = 10
export const DATA_SOURCE = SOURCE

function keysOf(nameTh: string, nameEn: string): Keys {
  const th = toKey(nameTh)
  const en = toKey(nameEn)
  return { th, thSkel: toSkeleton(th), en, enSkel: toSkeleton(en) }
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key)
  if (list) list.push(value)
  else map.set(key, [value])
}

let cached: Db | undefined

/** Indexes are built on first use (about 15 ms), so importing the package stays cheap. */
export function db(): Db {
  if (cached) return cached

  const regions = REGIONS.map(([id, nameTh, nameEn]) => ({ id, nameTh, nameEn }))
  const provinces = PROVINCES.map(([id, nameTh, nameEn, regionId]) => ({
    item: { id, nameTh, nameEn, regionId },
    keys: keysOf(nameTh, nameEn),
  }))
  const districts = DISTRICTS.map(([id, nameTh, nameEn]) => ({
    item: { id, nameTh, nameEn, provinceId: Math.floor(id / 100) },
    keys: keysOf(nameTh, nameEn),
  }))
  const subDistricts = SUB_DISTRICTS.map(([id, nameTh, nameEn, postcode, lat, lng]) => {
    const districtId = Math.floor(id / 100)
    return {
      item: {
        id,
        nameTh,
        nameEn,
        districtId,
        provinceId: Math.floor(districtId / 100),
        postcode: String(postcode),
        lat,
        lng,
      },
      keys: keysOf(nameTh, nameEn),
    }
  })

  const districtsOf = new Map<number, District[]>()
  for (const { item } of districts) push(districtsOf, item.provinceId, item)
  const subDistrictsOf = new Map<number, SubDistrict[]>()
  const postcode = new Map<string, SubDistrict[]>()
  for (const { item } of subDistricts) {
    push(subDistrictsOf, item.districtId, item)
    push(postcode, item.postcode, item)
  }

  cached = {
    regions,
    provinces,
    districts,
    subDistricts,
    province: new Map(provinces.map(({ item }) => [item.id, item])),
    district: new Map(districts.map(({ item }) => [item.id, item])),
    subDistrict: new Map(subDistricts.map(({ item }) => [item.id, item])),
    districtsOf,
    subDistrictsOf,
    postcode,
  }
  return cached
}

export function areaOf(sub: SubDistrict): Area {
  const d = db()
  return { subDistrict: sub, district: d.district.get(sub.districtId)!, province: d.province.get(sub.provinceId)! }
}

export function isBangkok(provinceId: number): boolean {
  return provinceId === BANGKOK_ID
}
