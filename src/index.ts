import { areaOf, db } from './db'
import type { Area, District, Province, Region, SubDistrict } from './types'

export { DATA_SOURCE, isBangkok } from './db'
export { formatAddress, type AddressInput, type FormatOptions } from './format'
export { reverseGeocode, type NearbyArea, type ReverseOptions } from './geo'
export { parseAddress, MAX_ADDRESS_LENGTH, type ParsedAddress, type ParseWarning, type WarningCode } from './parse'
export { search, MAX_QUERY_LENGTH, type SearchOptions, type SearchResult } from './search'
export { normalize } from './text'
export type { Area, District, PlaceType, Province, Region, SubDistrict } from './types'

/** All lists are sorted by Thai name, the order people expect in a dropdown. */
export function listRegions(): Region[] {
  return db().regions
}

export function listProvinces(regionId?: number): Province[] {
  const all = db().provinces.map((p) => p.item)
  return regionId === undefined ? all : all.filter((p) => p.regionId === regionId)
}

export function listDistricts(provinceId?: number): District[] {
  if (provinceId === undefined) return db().districts.map((d) => d.item)
  return db().districtsOf.get(provinceId) ?? []
}

export function listSubDistricts(districtId?: number): SubDistrict[] {
  if (districtId === undefined) return db().subDistricts.map((s) => s.item)
  return db().subDistrictsOf.get(districtId) ?? []
}

export function getProvince(id: number): Province | undefined {
  return db().province.get(id)
}

export function getDistrict(id: number): District | undefined {
  return db().district.get(id)
}

export function getSubDistrict(id: number): SubDistrict | undefined {
  return db().subDistrict.get(id)
}

/** Sub-district together with its district and province. */
export function getArea(subDistrictId: number): Area | undefined {
  const sub = db().subDistrict.get(subDistrictId)
  return sub && areaOf(sub)
}

export function lookupPostcode(postcode: string | number): Area[] {
  return (db().postcode.get(String(postcode).trim()) ?? []).map(areaOf)
}
