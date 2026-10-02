import { areaOf, db } from './db'
import type { Area, SubDistrict } from './types'

export interface NearbyArea extends Area {
  distanceKm: number
}

export interface ReverseOptions {
  /** How many results to return, nearest first. Default 1, max 20. */
  limit?: number
  /** Ignore sub-districts whose centre is farther than this. Default 30 km. */
  maxDistanceKm?: number
}

const EARTH_RADIUS_KM = 6371
const rad = (deg: number) => (deg * Math.PI) / 180

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a))
}

/**
 * Nearest sub-districts by distance to their centre point. This is an approximation:
 * the dataset has centre points, not boundaries, and 14 sub-districts have no coordinates at all.
 */
export function reverseGeocode(lat: number, lng: number, options: ReverseOptions = {}): NearbyArea[] {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new RangeError('lat must be between -90 and 90')
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) throw new RangeError('lng must be between -180 and 180')
  const limit = Math.min(Math.max(Math.trunc(options.limit ?? 1), 1), 20)
  const maxDistanceKm = options.maxDistanceKm ?? 30

  const hits: { sub: SubDistrict; km: number }[] = []
  for (const { item } of db().subDistricts) {
    if (item.lat === null || item.lng === null) continue
    const km = haversine(lat, lng, item.lat, item.lng)
    if (km <= maxDistanceKm) hits.push({ sub: item, km })
  }
  return hits
    .sort((a, b) => a.km - b.km)
    .slice(0, limit)
    .map(({ sub, km }) => ({ ...areaOf(sub), distanceKm: Math.round(km * 100) / 100 }))
}
