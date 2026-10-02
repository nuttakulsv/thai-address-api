import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { parseArgs } from 'node:util'

const REPO = 'kongvut/thai-province-data'
const PINNED_SHA = '7d689e478a577a1c9348f2b998c39dd4c2bf153d'
const BANGKOK = 10
const HDX_URL = 'https://data.humdata.org/dataset/cod-ab-tha'

interface Named {
  th: string
  en: string
}
interface RawProvince {
  id: number
  name: Named
  geography_id: number
  deleted_at: string | null
}
interface RawDistrict {
  id: number
  name: Named
  prefix: Named
  province_id: number
  deleted_at: string | null
}
interface RawSubDistrict {
  id: number
  zip_code: number
  name: Named
  prefix: Named
  district_id: number
  lat: number | null
  long: number | null
  deleted_at: string | null
}
interface RawGeography {
  id: number
  name: Named
}

const { values } = parseArgs({
  options: { sha: { type: 'string' }, latest: { type: 'boolean', default: false } },
})

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { 'user-agent': 'thai-address-api-build' } })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`)
  return (await res.json()) as T
}

async function resolveSha(): Promise<{ sha: string; date: string }> {
  const ref = values.latest ? 'master' : (values.sha ?? PINNED_SHA)
  const commit = await getJson<{ sha: string; commit: { committer: { date: string } } }>(
    `https://api.github.com/repos/${REPO}/commits/${ref}`,
  )
  return { sha: commit.sha, date: commit.commit.committer.date }
}

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Data check failed: ${message}`)
}

const notes: string[] = []

function clean(name: Named, where: string): Named {
  const th = name.th.trim()
  let en = name.en.trim()
  if (en.startsWith('*')) {
    notes.push(`Removed a stray "*" from the English name of ${where} (${en})`)
    en = en.slice(1).trim()
  }
  check(th && en, `empty name at ${where}`)
  return { th, en }
}

const round = (n: number) => Math.round(n * 1e5) / 1e5

async function main() {
  const { sha, date } = await resolveSha()
  const base = `https://raw.githubusercontent.com/${REPO}/${sha}`
  console.log(`Source ${REPO}@${sha} (${date})`)

  const [geographies, rawProvinces, rawDistricts, rawSubs] = await Promise.all([
    getJson<RawGeography[]>(`${base}/data/raw/geographies.json`),
    getJson<RawProvince[]>(`${base}/api/latest/province.json`),
    getJson<RawDistrict[]>(`${base}/api/latest/district.json`),
    getJson<RawSubDistrict[]>(`${base}/api/latest/sub_district.json`),
  ])

  const live = <T extends { deleted_at: string | null }>(rows: T[]) => rows.filter((r) => !r.deleted_at)
  const provincesIn = live(rawProvinces)
  const subs = live(rawSubs)
  const subCount = new Map<number, number>()
  for (const s of subs) subCount.set(s.district_id, (subCount.get(s.district_id) ?? 0) + 1)

  const districts = live(rawDistricts).filter((d) => {
    if (subCount.has(d.id)) return true
    notes.push(`Dropped district ${d.id} "${d.name.th}" because it has no sub-districts`)
    return false
  })

  // The source keys provinces by its own running number. Districts and sub-districts already use
  // the official DOPA codes, so the province code is the first two digits of any of its districts.
  const provinceCode = new Map<number, number>()
  for (const d of districts) {
    const code = Math.floor(d.id / 100)
    const seen = provinceCode.get(d.province_id)
    check(seen === undefined || seen === code, `province ${d.province_id} maps to several codes`)
    provinceCode.set(d.province_id, code)
  }

  const districtIds = new Set(districts.map((d) => d.id))
  for (const s of subs) {
    check(districtIds.has(s.district_id), `sub-district ${s.id} points to missing district ${s.district_id}`)
    check(Math.floor(s.id / 100) === s.district_id, `sub-district ${s.id} code does not start with ${s.district_id}`)
    check(/^[1-9]\d{4}$/.test(String(s.zip_code)), `sub-district ${s.id} has postcode ${s.zip_code}`)
  }
  for (const d of districts) {
    const bangkok = provinceCode.get(d.province_id) === BANGKOK
    check(d.prefix.th === (bangkok ? 'เขต' : 'อำเภอ'), `district ${d.id} prefix ${d.prefix.th}`)
  }
  for (const s of subs) {
    const bangkok = Math.floor(s.district_id / 100) === BANGKOK
    check(s.prefix.th === (bangkok ? 'แขวง' : 'ตำบล'), `sub-district ${s.id} prefix ${s.prefix.th}`)
  }
  check(
    provincesIn.every((p) => provinceCode.has(p.id)),
    'a province has no districts',
  )

  const collator = new Intl.Collator('th')
  const byThai = <T extends { name: Named }>(a: T, b: T) => collator.compare(a.name.th, b.name.th)

  const regions = geographies.map((g) => [g.id, g.name.th, g.name.en] as const)
  const provinces = [...provincesIn].sort(byThai).map((p) => {
    const n = clean(p.name, `province ${p.id}`)
    return [provinceCode.get(p.id)!, n.th, n.en, p.geography_id] as const
  })
  const districtRows = [...districts].sort(byThai).map((d) => {
    const n = clean(d.name, `district ${d.id}`)
    return [d.id, n.th, n.en] as const
  })
  // Coordinates come from polygon centroids in OCHA's COD-AB boundaries (data/centroids.csv).
  // The upstream points are missing for every Bangkok แขวง and are sometimes far off elsewhere.
  const centroids = new Map<number, [number, number]>()
  const csv = (await readFile('data/centroids.csv', 'utf8')).trim().split('\n').slice(1)
  for (const line of csv) {
    const [id, lat, lng] = line.split(',').map(Number) as [number, number, number]
    centroids.set(id, [lat, lng])
  }
  const subRows = [...subs].sort(byThai).map((s) => {
    const n = clean(s.name, `sub-district ${s.id}`)
    const c = centroids.get(s.id)
    return [s.id, n.th, n.en, s.zip_code, c ? round(c[0]) : null, c ? round(c[1]) : null] as const
  })
  const noCoords = subRows.filter((r) => r[4] === null).map((r) => `${r[0]} ${r[1]}`)

  const rows = (list: readonly (readonly unknown[])[]) => list.map((r) => JSON.stringify(r)).join(',\n')
  const source = { repo: REPO, sha, date }
  const file = `// Built by scripts/build-data.ts from ${REPO}@${sha.slice(0, 7)}. Do not edit by hand.
export const SOURCE = ${JSON.stringify(source)} as const

export type RegionRow = [id: number, nameTh: string, nameEn: string]
export type ProvinceRow = [id: number, nameTh: string, nameEn: string, regionId: number]
export type DistrictRow = [id: number, nameTh: string, nameEn: string]
export type SubDistrictRow = [id: number, nameTh: string, nameEn: string, postcode: number, lat: number | null, lng: number | null]

export const REGIONS: RegionRow[] = [
${rows(regions)}
]

export const PROVINCES: ProvinceRow[] = [
${rows(provinces)}
]

export const DISTRICTS: DistrictRow[] = [
${rows(districtRows)}
]

export const SUB_DISTRICTS: SubDistrictRow[] = [
${rows(subRows)}
]
`
  await mkdir('src/data', { recursive: true })
  await writeFile('src/data/data.ts', file)

  const postcodes = new Set(subs.map((s) => s.zip_code)).size
  const missingCoords = subRows.filter((r) => r[4] === null).length
  const khet = districts.filter((d) => d.prefix.th === 'เขต').length
  const khwaeng = subs.filter((s) => s.prefix.th === 'แขวง').length
  const bytes = Buffer.byteLength(file)
  const gz = gzipSync(file).length

  const stats = [
    ['Regions', regions.length],
    ['Provinces', provinces.length],
    ['Districts', `${districtRows.length} (${districtRows.length - khet} อำเภอ + ${khet} เขต)`],
    ['Sub-districts', `${subRows.length} (${subRows.length - khwaeng} ตำบล + ${khwaeng} แขวง)`],
    ['Postcodes', postcodes],
    ['Sub-districts with coordinates', subRows.length - missingCoords],
    ['Sub-districts without coordinates', missingCoords],
    ['Embedded size', `${(bytes / 1024).toFixed(0)} KB raw, ${(gz / 1024).toFixed(0)} KB gzipped`],
  ] as const

  const readme = `# Data

The dataset in \`src/data/data.ts\` is built from two sources:

- Names, codes and postcodes: [${REPO}](https://github.com/${REPO}), MIT License.
- Coordinates: centre points of the sub-district polygons in [Thailand - Subnational Administrative Boundaries](${HDX_URL}) (COD-AB, Royal Thai Survey Department via OCHA), CC BY-IGO 3.0. Extracted once into \`data/centroids.csv\`.

| | |
|---|---|
| Source commit | [\`${sha.slice(0, 7)}\`](https://github.com/${REPO}/tree/${sha}) |
| Commit date | ${date.slice(0, 10)} |
${stats.map(([k, v]) => `| ${k} | ${v} |`).join('\n')}

## Changes made during the build

- Province ids are the official two-digit DOPA codes (for example \`10\` Bangkok, \`11\` Samut Prakan) instead of the source's running numbers. District and sub-district ids are unchanged, they are already DOPA codes.
- Prefixes (เขต/อำเภอ, แขวง/ตำบล) are not stored. They depend only on whether the area is in Bangkok, and the build checks that this holds for every row.
- Rows are sorted by Thai collation, so lists come out in the order people expect in a dropdown.
- Coordinates are rounded to 5 decimal places. The upstream dataset has points too, but none for Bangkok and some that sit tens of kilometres from the area they belong to, so they are not used.
- These sub-districts have no coordinates because they were created after the boundary dataset was published: ${noCoords.join(', ')}.
${[...new Set(notes)].map((n) => `- ${n}`).join('\n')}

## Refreshing the coordinates

\`data/centroids.csv\` holds \`adm3_pcode\`, \`center_lat\` and \`center_lon\` from the \`tha_admin3\` sheet of \`tha_admin_boundaries.xlsx\` on [HDX](${HDX_URL}), with the \`TH\` prefix removed. To refresh it:

\`\`\`bash
pip install openpyxl
python3 - <<'PY'
import openpyxl
ws = openpyxl.load_workbook('tha_admin_boundaries.xlsx', read_only=True)['tha_admin3']
rows = ws.iter_rows(values_only=True)
col = {name: i for i, name in enumerate(next(rows))}
lines = sorted('%d,%.5f,%.5f' % (int(r[col['adm3_pcode']][2:]), r[col['center_lat']], r[col['center_lon']]) for r in rows)
open('data/centroids.csv', 'w').write('id,lat,lng\\n' + '\\n'.join(lines) + '\\n')
PY
\`\`\`

## Updating

\`\`\`bash
npm run data:build             # rebuild from the pinned commit
npm run data:build -- --latest # rebuild from the newest commit on master
npm run data:build -- --sha <commit>
\`\`\`

After updating, run \`npm test\`. The data tests check exact counts on purpose, so a change upstream shows up as a failing test you can review before release. Then update \`PINNED_SHA\` in \`scripts/build-data.ts\`.
`
  await mkdir('data', { recursive: true })
  await writeFile('data/README.md', readme)

  for (const [k, v] of stats) console.log(`${k.padEnd(34)} ${v}`)
  for (const n of new Set(notes)) console.log(`note: ${n}`)
}

await main()
