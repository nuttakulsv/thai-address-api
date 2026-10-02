export interface Region {
  id: number
  nameTh: string
  nameEn: string
}

export interface Province {
  /** Two-digit DOPA code, e.g. 10 for Bangkok. */
  id: number
  nameTh: string
  nameEn: string
  regionId: number
}

export interface District {
  /** Four-digit DOPA code, e.g. 1001 for Phra Nakhon. */
  id: number
  nameTh: string
  nameEn: string
  provinceId: number
}

export interface SubDistrict {
  /** Six-digit DOPA code, e.g. 100101. */
  id: number
  nameTh: string
  nameEn: string
  districtId: number
  provinceId: number
  postcode: string
  lat: number | null
  lng: number | null
}

export interface Area {
  subDistrict: SubDistrict
  district: District
  province: Province
}

export type PlaceType = 'province' | 'district' | 'subDistrict'
