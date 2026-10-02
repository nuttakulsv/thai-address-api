import { db, isBangkok } from './db'
import { parseAddress } from './parse'
import type { District, Province, SubDistrict } from './types'

export interface AddressInput {
  houseNo?: string | null
  moo?: string | null
  village?: string | null
  soi?: string | null
  road?: string | null
  subDistrict?: SubDistrict | number | null
  district?: District | number | null
  province?: Province | number | null
  postcode?: string | null
}

export interface FormatOptions {
  lang?: 'th' | 'en'
  /** "full" writes ตำบล/อำเภอ/จังหวัด, "short" writes ต./อ./จ. Ignored for English. */
  style?: 'full' | 'short'
}

const strip = (value: string, prefix: RegExp) => value.replace(prefix, '').trim()

function resolve(input: AddressInput) {
  const d = db()
  const sub = typeof input.subDistrict === 'number' ? d.subDistrict.get(input.subDistrict) : input.subDistrict
  const districtIn = typeof input.district === 'number' ? d.district.get(input.district) : input.district
  const provinceIn = typeof input.province === 'number' ? d.province.get(input.province) : input.province
  const district = districtIn ?? (sub ? d.district.get(sub.districtId) : undefined)
  const provinceId = district?.provinceId ?? sub?.provinceId
  const province = provinceIn ?? (provinceId === undefined ? undefined : d.province.get(provinceId))
  return { sub: sub ?? undefined, district: district ?? undefined, province: province ?? undefined }
}

/**
 * Formats an address the way Thailand Post expects it.
 * Bangkok uses แขวง/เขต and drops "จังหวัด"; everywhere else uses ตำบล/อำเภอ/จังหวัด.
 */
export function formatAddress(input: AddressInput, options: FormatOptions = {}): string {
  const { lang = 'th', style = 'full' } = options
  const { sub, district, province } = resolve(input)
  const postcode = input.postcode ?? sub?.postcode
  const bangkok = province ? isBangkok(province.id) : false
  const moo = input.moo && strip(input.moo, /^(หมู่ที่|หมู่|ม\.|moo)\s*/i)
  const village = input.village && strip(input.village, /^(หมู่บ้าน|ม\.บ\.|มบ\.)\s*/)
  const soi = input.soi && strip(input.soi, /^(ซอย|ซ\.|soi)\s*/i)
  const road = input.road && strip(input.road, /^(ถนน|ถ\.)\s*/)

  if (lang === 'en') {
    const parts = [
      [input.houseNo, moo && `Moo ${moo}`].filter(Boolean).join(' '),
      village && `${village} Village`,
      soi && `Soi ${soi}`,
      road && (/\b(road|rd\.?)$/i.test(road) ? road : `${road} Road`),
      sub?.nameEn,
      district?.nameEn,
      [province?.nameEn, postcode].filter(Boolean).join(' '),
    ]
    return parts.filter(Boolean).join(', ')
  }

  const short = style === 'short'
  const parts = [
    input.houseNo,
    moo && (short ? `ม.${moo}` : `หมู่ที่ ${moo}`),
    village && (short ? `มบ.${village}` : `หมู่บ้าน${village}`),
    soi && (short ? `ซ.${soi}` : `ซอย${soi}`),
    road && (short ? `ถ.${road}` : `ถนน${road}`),
    sub && (bangkok ? `แขวง${sub.nameTh}` : short ? `ต.${sub.nameTh}` : `ตำบล${sub.nameTh}`),
    district && (bangkok ? `เขต${district.nameTh}` : short ? `อ.${district.nameTh}` : `อำเภอ${district.nameTh}`),
    province &&
      (bangkok ? (short ? 'กรุงเทพฯ' : province.nameTh) : short ? `จ.${province.nameTh}` : `จังหวัด${province.nameTh}`),
    postcode,
  ]
  return parts.filter(Boolean).join(' ')
}

/** What the API and the demo page return for a parse: parseAddress() plus ready-to-use strings. */
export function parseWithFormat(text: string) {
  const parsed = parseAddress(text)
  const formatted = parsed.province ? { th: formatAddress(parsed), en: formatAddress(parsed, { lang: 'en' }) } : null
  return { ...parsed, formatted }
}
