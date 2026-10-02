import { areaOf, db, type Indexed } from './db'
import { PROVINCE_ALIASES, fullMatch, toQuery, type MatchKind, type Query } from './match'
import { cleanText, editDistance, hasLatin, isThai } from './text'
import type { Area, District, Province, SubDistrict } from './types'

export type WarningCode =
  'NOT_FOUND' | 'AMBIGUOUS' | 'FUZZY_MATCH' | 'INFERRED' | 'CONFLICT' | 'POSTCODE_MISMATCH' | 'UNKNOWN_POSTCODE'

export interface ParseWarning {
  code: WarningCode
  message: string
}

export interface ParsedAddress {
  houseNo: string | null
  moo: string | null
  village: string | null
  soi: string | null
  road: string | null
  subDistrict: SubDistrict | null
  district: District | null
  province: Province | null
  /** Taken from the matched sub-district when there is one, otherwise from the text. */
  postcode: string | null
  phone: string | null
  /** Text that was not recognised, such as a name or a building. */
  rest: string | null
  /** 0 to 1. Rough, but stable enough to decide when to ask the user to check. */
  confidence: number
  warnings: ParseWarning[]
  /** Best matching areas, best first. Useful when the address is ambiguous. */
  candidates: (Area & { score: number })[]
}

export const MAX_ADDRESS_LENGTH = 500

type Level = 'subDistrict' | 'district' | 'province'
type Field = 'houseNo' | 'moo' | 'village' | 'soi' | 'road' | 'phone'

interface Piece {
  raw: string
  q: Query
}

interface Evidence {
  score: number
  kind: MatchKind
  raw: string
  /** Index into pieces, or -1 for a value that came with a marker such as "ต.". */
  piece: number
  start: number
  end: number
}

const WEIGHT = { subDistrict: 3, district: 2, province: 2, postcode: 1.5 }
const LEVEL_NAME: Record<Level, string> = { subDistrict: 'sub-district', district: 'district', province: 'province' }

// A marker spelled out in full can also appear inside a place name (สามตำบล, หลักเขต, คลองถนน),
// so those only count when they don't follow a Thai consonant.
const NC = '(?<![\\u0E01-\\u0E2E])'
const MARKER = new RegExp(
  [
    '(?<houseNo>บ้านเลขที่|เลขที่)',
    '(?<village>หมู่บ้าน|ม\\.บ\\.|มบ\\.)',
    `(?<moo>หมู่ที่|${NC}หมู่|${NC}ม\\.)`,
    `(?<soi>ซอย|${NC}ซ\\.)`,
    `(?<road>${NC}ถนน|${NC}ถ\\.)`,
    `(?<subDistrict>แขวง|${NC}ตำบล|${NC}ต\\.)`,
    `(?<district>อำเภอ|${NC}เขต|${NC}อ\\.)`,
    `(?<province>จังหวัด|${NC}จ\\.)`,
  ].join('|'),
  'g',
)
const LEVEL_MARKER = '(?:แขวง|ตำบล|ต\\.|อำเภอ|เขต|อ\\.|จังหวัด|จ\\.)\\s*'
const PHONE =
  /(?:(?:โทรศัพท์|โทร|มือถือ|tel|phone|mobile)\.?\s*:?\s*)?((?:\+66\s?|(?<![\d/])0)(?:[689]\d[-\s]?\d{3,4}[-\s]?\d{3,4}|[2-7][-\s]?\d{3}[-\s]?\d{4}))(?![\d/])/gi
const POSTCODE = /(?<![\d/.-])([1-9]\d{4})(?![\d/-])/g
const HOUSE = /^(?:no\.?\s*)?(\d+(?:\/\d+)*(?:-\d+)?)(?![\d.])/i
const EN_PREFIX = /^(tambon|khwaeng|kwaeng|amphoe|amphur|khet|changwat)\s+(.+)$/i
const EN_SUFFIX = /^(.+?)\s+(sub-?district|district|province)$/i
const EN_LEVEL: Record<string, Level> = {
  tambon: 'subDistrict',
  khwaeng: 'subDistrict',
  kwaeng: 'subDistrict',
  subdistrict: 'subDistrict',
  'sub-district': 'subDistrict',
  amphoe: 'district',
  amphur: 'district',
  khet: 'district',
  district: 'district',
  changwat: 'province',
  province: 'province',
}

let defusers: { re: RegExp; to: string }[] | undefined

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Breaks up marker words inside known names ("แขวง ถนนพญาไท") with a word joiner that toKey() removes again. */
function getDefusers() {
  if (defusers) return defusers
  const names = new Set<string>()
  const d = db()
  for (const list of [d.districts, d.subDistricts]) {
    for (const { item } of list) if (/ตำบล|เขต|หมู่|ถนน|ซอย/.test(item.nameTh)) names.add(item.nameTh)
  }
  defusers = [...names].map((name) => ({
    re: new RegExp(`(${LEVEL_MARKER})${escapeRegExp(name)}`, 'g'),
    to: `$1${name.replace(/(ตำบล|เขต|หมู่|ถนน|ซอย)/g, (m) => `${m[0]}⁠${m.slice(1)}`)}`,
  }))
  return defusers
}

function takeName(value: string): [string, string] {
  const words = value.split(' ')
  let n = 1
  while (n < words.length && /^(\d|แยก)/.test(words[n]!)) n++
  return [words.slice(0, n).join(' '), words.slice(n).join(' ')]
}

function overlaps(a: Evidence, b: Evidence) {
  return a.piece >= 0 && a.piece === b.piece && a.start < b.end && b.start < a.end
}

function substringMatch(pattern: string, text: string): number {
  return editDistance(pattern, text, 1, 'substring')
}

function labeledEvidence<T extends { id: number }>(
  queries: Query[],
  list: Indexed<T>[],
  aliases: Record<number, string[]> | undefined,
  fallback: string[],
): Map<number, Evidence> {
  const out = new Map<number, Evidence>()
  for (const q of queries) {
    let best = 0
    for (const { item, keys } of list) {
      const m = fullMatch(q, keys, aliases?.[item.id])
      if (!m) continue
      best = Math.max(best, m.score)
      if ((out.get(item.id)?.score ?? 0) < m.score) {
        out.set(item.id, { ...m, raw: q.raw, piece: -1, start: 0, end: 0 })
      }
    }
    if (best < 0.5) fallback.push(q.raw)
  }
  return out
}

function poolEvidence<T extends { id: number }>(
  pieces: Piece[],
  list: Indexed<T>[],
  aliases: Record<number, string[]> | undefined,
  fuzzyScope: (item: T) => boolean,
): Map<number, Evidence[]> {
  const out = new Map<number, Evidence[]>()
  if (pieces.length === 0) return out
  for (const { item, keys } of list) {
    let found: Evidence[] | undefined
    const add = (e: Evidence) => (found ??= []).push(e)
    pieces.forEach((p, i) => {
      const m = fullMatch(p.q, keys, aliases?.[item.id])
      if (m) add({ score: m.score * 0.9, kind: m.kind, raw: p.raw, piece: i, start: 0, end: p.q.key.length })
      const key = p.q.thai ? keys.th : keys.en
      if (key.length < 3 || p.q.key.length <= key.length) return
      let at = p.q.key.indexOf(key)
      if (at >= 0) {
        while (at >= 0) {
          add({
            score: key.length >= 4 ? 0.8 : 0.6,
            kind: 'contains',
            raw: p.raw,
            piece: i,
            start: at,
            end: at + key.length,
          })
          at = p.q.key.indexOf(key, at + 1)
        }
      } else if (key.length >= 6 && fuzzyScope(item) && substringMatch(key, p.q.key) <= 1) {
        add({ score: 0.55, kind: 'fuzzy', raw: p.raw, piece: i, start: 0, end: key.length })
      }
    })
    if (found)
      out.set(
        item.id,
        found.sort((a, b) => b.score - a.score),
      )
  }
  return out
}

function choose(labeled: Evidence | undefined, pool: Evidence[] | undefined, used: Evidence[]) {
  let best = labeled
  for (const e of pool ?? []) {
    if (best && e.score <= best.score) break
    if (used.some((u) => overlaps(u, e))) continue
    best = e
    break
  }
  if (best) used.push(best)
  return best
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Splits a free-text Thai or English address into its parts and matches it against the
 * official list of sub-districts. Typos, abbreviations, missing levels and missing spaces are fine.
 */
export function parseAddress(input: string): ParsedAddress {
  const fields: Record<Field, string | null> = {
    houseNo: null,
    moo: null,
    village: null,
    soi: null,
    road: null,
    phone: null,
  }
  const set = (field: Field, value: string | undefined) => {
    if (value && fields[field] === null) fields[field] = value.trim()
  }
  const warnings: ParseWarning[] = []
  const warn = (code: WarningCode, message: string) => warnings.push({ code, message })
  const d = db()

  let text = cleanText(String(input ?? '').slice(0, MAX_ADDRESS_LENGTH))
  text = text.replace(PHONE, (_, num: string) => {
    set('phone', num.replace(/\D/g, '').replace(/^66/, '0'))
    return ' '
  })
  text = text.replace(/กทม\.?/g, ' กรุงเทพมหานคร ').replace(/จ\.ป\.ร\./g, 'จปร')
  for (const { re, to } of getDefusers()) text = text.replace(re, to)

  let givenPostcode: string | null = null
  const zips = [...text.matchAll(POSTCODE)].filter((m) => m.index! > 0 || text.length <= 5)
  const zip = zips.filter((m) => d.postcode.has(m[1]!)).at(-1) ?? zips.at(-1)
  if (zip) {
    givenPostcode = zip[1]!
    text = `${text.slice(0, zip.index)} ${text.slice(zip.index! + 5)}`
  }

  const labeled: Record<Level, Query[]> = { subDistrict: [], district: [], province: [] }
  const loose: string[] = []
  const markers = [...text.matchAll(MARKER)]
  const headWords = text
    .slice(0, markers[0]?.index ?? text.length)
    .trim()
    .split(' ')
  const houseAt = headWords.findIndex((w, i) => /^\d+(?:\/\d+)*(?:-\d+)?$/.test(w) && (i === 0 || w.includes('/')))
  if (houseAt >= 0) set('houseNo', headWords.splice(houseAt, 1)[0])
  loose.push(headWords.join(' '))

  markers.forEach((m, i) => {
    const field = Object.entries(m.groups!).find(([, v]) => v !== undefined)![0] as Field | Level
    const value = text
      .slice(m.index! + m[0].length, markers[i + 1]?.index ?? text.length)
      .replace(/^[\s:]+/, '')
      .trim()
    if (field === 'houseNo') {
      const h = value.match(HOUSE)
      set('houseNo', h?.[1])
      loose.push(h ? value.slice(h[0].length) : value)
    } else if (field === 'moo') {
      const n = value.match(/^\d+/)
      set('moo', n?.[0])
      loose.push(n ? value.slice(n[0].length) : value)
    } else if (field === 'village' || field === 'soi' || field === 'road') {
      const [name, rest] = takeName(value)
      set(field, name)
      loose.push(rest)
    } else if (field !== 'phone') {
      const [word, ...rest] = value.split(' ')
      if (word) labeled[field].push(toQuery(word))
      loose.push(rest.join(' '))
    }
  })

  const pieces: Piece[] = []
  const addPiece = (raw: string) => {
    const q = toQuery(raw)
    if (q.key && !q.digits) pieces.push({ raw, q })
  }
  const english = (segment: string) => {
    let s = segment
    if (fields.houseNo === null) {
      const h = s.match(HOUSE)
      if (h) {
        set('houseNo', h[1])
        s = s.slice(h[0].length)
      }
    }
    s = s.replace(/\b(?:moo|m\.)\s*(\d+)\b/i, (_, n: string) => (set('moo', n), '')).trim()
    const soi = s.match(/\bsoi\s+(.+)$/i)
    if (soi) {
      set('soi', soi[1])
      s = s.slice(0, soi.index).trim()
    }
    const road = s.match(/^(.+?)\s+(?:road|rd\.?)$/i) ?? s.match(/^(?:thanon|road)\s+(.+)$/i)
    if (road) return set('road', road[1])
    const prefix = s.match(EN_PREFIX)
    const suffix = s.match(EN_SUFFIX)
    if (prefix) labeled[EN_LEVEL[prefix[1]!.toLowerCase()]!].push(toQuery(prefix[2]!))
    else if (suffix) labeled[EN_LEVEL[suffix[2]!.toLowerCase()]!].push(toQuery(suffix[1]!))
    else if (s) addPiece(s)
  }
  const splitLoose = (chunk: string) => {
    for (const segment of chunk.split(/[,;\n]+/)) {
      const s = segment.trim()
      if (!s) continue
      if (hasLatin(s) && !isThai(s)) english(s)
      else s.split(' ').forEach(addPiece)
    }
  }
  loose.forEach(splitLoose)

  const fallback: string[] = []
  const labeledProvince = labeledEvidence(labeled.province, d.provinces, PROVINCE_ALIASES, fallback)
  const labeledDistrict = labeledEvidence(labeled.district, d.districts, undefined, fallback)
  const labeledSub = labeledEvidence(labeled.subDistrict, d.subDistricts, undefined, fallback)
  fallback.forEach(splitLoose)

  const poolProvince = poolEvidence(pieces, d.provinces, PROVINCE_ALIASES, () => true)
  const provinceHit = new Set([...labeledProvince.keys(), ...poolProvince.keys()])
  const poolDistrict = poolEvidence(pieces, d.districts, undefined, (x) => provinceHit.has(x.provinceId))
  const districtHit = new Set([...labeledDistrict.keys(), ...poolDistrict.keys()])
  const postcodeSubs = new Set((givenPostcode && d.postcode.get(givenPostcode)?.map((s) => s.id)) || [])
  const poolSub = poolEvidence(
    pieces,
    d.subDistricts,
    undefined,
    (x) => districtHit.has(x.districtId) || postcodeSubs.has(x.id),
  )

  interface Candidate {
    sub: SubDistrict
    total: number
    ev: Record<Level, Evidence | undefined>
    zip: boolean
  }
  const candidates: Candidate[] = []
  for (const { item: sub } of d.subDistricts) {
    if (
      !labeledSub.has(sub.id) &&
      !poolSub.has(sub.id) &&
      !districtHit.has(sub.districtId) &&
      !provinceHit.has(sub.provinceId) &&
      !postcodeSubs.has(sub.id)
    ) {
      continue
    }
    const used: Evidence[] = []
    const ev = {
      subDistrict: choose(labeledSub.get(sub.id), poolSub.get(sub.id), used),
      district: choose(labeledDistrict.get(sub.districtId), poolDistrict.get(sub.districtId), used),
      province: choose(labeledProvince.get(sub.provinceId), poolProvince.get(sub.provinceId), used),
    }
    const zipOk = givenPostcode === sub.postcode
    const total =
      WEIGHT.subDistrict * (ev.subDistrict?.score ?? 0) +
      WEIGHT.district * (ev.district?.score ?? 0) +
      WEIGHT.province * (ev.province?.score ?? 0) +
      WEIGHT.postcode * (zipOk ? 1 : 0)
    if (total > 0) candidates.push({ sub, total, ev, zip: zipOk })
  }
  candidates.sort((a, b) => b.total - a.total)

  const result: ParsedAddress = {
    ...fields,
    subDistrict: null,
    district: null,
    province: null,
    postcode: givenPostcode,
    rest: null,
    confidence: 0,
    warnings,
    candidates: candidates.slice(0, 5).map((c) => ({ ...areaOf(c.sub), score: round2(c.total / 8.5) })),
  }

  if (givenPostcode && !d.postcode.has(givenPostcode)) {
    warn('UNKNOWN_POSTCODE', `Postcode ${givenPostcode} is not in the dataset`)
  }

  const top = candidates[0]
  if (!top) {
    warn('NOT_FOUND', 'No province, district or sub-district could be recognised')
    result.rest = pieces.map((p) => p.raw).join(' ') || null
    return result
  }

  const ties = candidates.filter((c) => top.total - c.total < 1e-9)
  const area = areaOf(top.sub)
  const sameDistrict = ties.every((c) => c.sub.districtId === top.sub.districtId)
  const sameProvince = ties.every((c) => c.sub.provinceId === top.sub.provinceId)
  result.subDistrict = ties.length === 1 ? top.sub : null
  result.district = sameDistrict ? area.district : null
  result.province = sameProvince ? area.province : null

  const subGiven = labeled.subDistrict.length > 0 || poolSub.size > 0
  if (ties.length > 1 && subGiven) {
    warn('AMBIGUOUS', `${ties.length} sub-districts match equally well, see candidates`)
  }
  if (result.subDistrict && !top.ev.subDistrict) {
    warn('INFERRED', `Sub-district ${top.sub.nameTh} was inferred from the postcode and district`)
  }

  const chosen: [Level, string][] = [
    ['subDistrict', top.sub.nameTh],
    ['district', area.district.nameTh],
    ['province', area.province.nameTh],
  ]
  for (const [level, name] of chosen) {
    const e = top.ev[level]
    if (e?.kind === 'fuzzy' && result[level]) warn('FUZZY_MATCH', `"${e.raw}" was read as ${LEVEL_NAME[level]} ${name}`)
    if (!e && labeled[level].length > 0 && result[level]) {
      const raw = labeled[level].map((q) => q.raw).join(', ')
      warn('CONFLICT', `${LEVEL_NAME[level]} "${raw}" does not fit the rest of the address, using ${name}`)
    }
  }

  if (result.subDistrict) {
    if (givenPostcode && givenPostcode !== result.subDistrict.postcode && d.postcode.has(givenPostcode)) {
      warn(
        'POSTCODE_MISMATCH',
        `Postcode ${givenPostcode} does not match ${result.subDistrict.nameTh}, expected ${result.subDistrict.postcode}`,
      )
    }
    result.postcode = result.subDistrict.postcode
  } else if (givenPostcode && result.district && d.postcode.has(givenPostcode)) {
    const inDistrict = d.subDistrictsOf.get(result.district.id)!.some((s) => s.postcode === givenPostcode)
    if (!inDistrict) warn('POSTCODE_MISMATCH', `Postcode ${givenPostcode} is not used in ${result.district.nameTh}`)
  }

  const present = (level: Level) => (result[level] ? top.ev[level] : undefined)
  let weight = 0
  let gained = 0
  for (const level of ['subDistrict', 'district', 'province'] as const) {
    const e = present(level)
    if (e) {
      weight += WEIGHT[level]
      gained += WEIGHT[level] * e.score
    }
  }
  if (givenPostcode) {
    weight += WEIGHT.postcode
    if (top.zip || (!result.subDistrict && !warnings.some((w) => w.code === 'POSTCODE_MISMATCH'))) {
      gained += WEIGHT.postcode
    }
  }
  const evidenceCount =
    (['subDistrict', 'district', 'province'] as const).filter(present).length + (givenPostcode ? 1 : 0)
  const coverage = evidenceCount >= 3 ? 1 : evidenceCount === 2 ? 0.85 : 0.65
  const conflicts = warnings.filter((w) => w.code === 'CONFLICT').length
  let confidence = weight ? (gained / weight) * coverage - 0.15 * conflicts : 0
  if (!result.subDistrict) confidence *= 0.8
  result.confidence = round2(Math.min(1, Math.max(0, confidence)))

  const coveredBy = new Map<number, number>()
  for (const e of Object.values(top.ev)) {
    if (e && e.piece >= 0) coveredBy.set(e.piece, (coveredBy.get(e.piece) ?? 0) + (e.end - e.start))
  }
  const rest = pieces.filter((p, i) => (coveredBy.get(i) ?? 0) < p.q.key.length * 0.8).map((p) => p.raw)
  result.rest = rest.join(' ') || null
  return result
}
