# thai-address-api

English | [ภาษาไทย](README.th.md)

[![CI](https://github.com/nuttakulsv/thai-address-api/actions/workflows/ci.yml/badge.svg)](https://github.com/nuttakulsv/thai-address-api/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/thai-address-api.svg)](https://www.npmjs.com/package/thai-address-api)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Every Thai province, district, sub-district and postcode, with a parser that turns a pasted address like `99/1ม.4ต.บางพลีใหน่อ.บางพลีจ.สมุทรปราการ10540` into clean, checked fields. Use it as an offline npm library or run it as a small HTTP API.

[![Demo page: address parsing, typo-tolerant autocomplete and cascading dropdowns](docs/screenshot.png)](https://nuttakulsv.github.io/thai-address-api/)

**[Try it in your browser](https://nuttakulsv.github.io/thai-address-api/)**. The demo runs entirely in the page with the bundled library. There is no server behind it, so nothing you type leaves your device.

```bash
npx thai-address-api            # API + demo page on http://localhost:3000
npm install thai-address-api    # or use it as a library, no network needed
```

## What it looks like

A customer pastes their address from a chat:

```bash
curl -s -X POST localhost:3000/v1/parse -H 'content-type: application/json' \
  -d '{"text":"คุณสมชาย 55/3 ซ.สุขุมวิท 101/1 แขวงบางจาก เขตพระโขนง กทม 10260 โทร 081-234-5678"}'
```

```json
{
  "houseNo": "55/3",
  "soi": "สุขุมวิท 101/1",
  "subDistrict": "บางจาก",
  "district": "พระโขนง",
  "province": "กรุงเทพมหานคร",
  "postcode": "10260",
  "phone": "0812345678",
  "rest": "คุณสมชาย",
  "confidence": 0.98,
  "formatted": {
    "th": "55/3 ซอยสุขุมวิท 101/1 แขวงบางจาก เขตพระโขนง กรุงเทพมหานคร 10260",
    "en": "55/3, Soi สุขุมวิท 101/1, Bang Chak, Phra Khanong, Bangkok 10260"
  }
}
```

(Output trimmed with `jq`. The full response also has ids, English names, `warnings` and ranked `candidates`.)

When something is off, it says so instead of guessing silently:

```json
{
  "subDistrict": "บางพลีใหญ่",
  "postcode": "10540",
  "confidence": 0.72,
  "warnings": [
    { "code": "FUZZY_MATCH", "message": "\"บางพลีใหน่\" was read as sub-district บางพลีใหญ่" },
    { "code": "POSTCODE_MISMATCH", "message": "Postcode 10560 does not match บางพลีใหญ่, expected 10540" }
  ]
}
```

## Why

Most Thai address datasets give you the lists and stop there. You still have to build the province, district and sub-district dropdowns, fill in the postcode, and deal with the reality that people type `กทม`, `อ.เมือง`, `ม.4`, Thai digits, no spaces, and the occasional typo. Shops that take orders over LINE end up retyping addresses by hand.

This package does that part:

- Parses free-text addresses in Thai or English and checks every level against the 7,436 official sub-districts, so the result is always a real area (or a clear warning).
- Autocomplete that finds `บางพลีใหญ่` from `บางพลีใหน่`, `ลุมพินี` from `ลุมพิ` or `Lumpini`, and narrows `หนองบัว ขอนแก่น` to the one in Khon Kaen.
- Postcode lookup, nearest sub-district from GPS coordinates, and address formatting that follows the Bangkok rules (แขวง/เขต, no "จังหวัด").
- The library has no runtime dependencies and needs no network. The data is about 180 KB gzipped.

## Install

```bash
npm install thai-address-api
```

Requires Node.js 20 or newer (tested on 20 and 22). The core uses no Node APIs, so it can also be bundled for browsers, Bun, Deno or Cloudflare Workers.

## Quick start

```ts
import { formatAddress, lookupPostcode, parseAddress, reverseGeocode, search } from 'thai-address-api'

const parsed = parseAddress('คุณสมชาย 55/3 ซ.สุขุมวิท 101/1 แขวงบางจาก เขตพระโขนง กทม 10260 โทร 081-234-5678')
parsed.subDistrict?.nameTh // 'บางจาก'
formatAddress(parsed) // '55/3 ซอยสุขุมวิท 101/1 แขวงบางจาก เขตพระโขนง กรุงเทพมหานคร 10260'

search('บางพลีใหน่', { limit: 1 })[0]?.labelTh // 'ต.บางพลีใหญ่ อ.บางพลี จ.สมุทรปราการ 10540'
lookupPostcode('10330').map((a) => a.subDistrict.nameTh) // ['ปทุมวัน', 'รองเมือง', 'ลุมพินี', 'วังใหม่']
reverseGeocode(18.7883, 98.9853)[0]?.subDistrict.nameTh // 'พระสิงห์'
```

Running [examples/library.ts](examples/library.ts) prints:

```text
parse    บางจาก พระโขนง กรุงเทพมหานคร 10260
         phone=0812345678 rest="คุณสมชาย" confidence=0.98
format   55/3 ซอยสุขุมวิท 101/1 แขวงบางจาก เขตพระโขนง กรุงเทพมหานคร 10260
format   55/3, Soi สุขุมวิท 101/1, Bang Chak, Phra Khanong, Bangkok 10260
search   ต.บางพลีใหญ่ อ.บางพลี จ.สมุทรปราการ 10540
postcode ปทุมวัน, รองเมือง, ลุมพินี, วังใหม่
reverse  ต.พระสิงห์ อ.เมืองเชียงใหม่ จ.เชียงใหม่ 50200 (0.3 km from centre)
```

There is also a CLI for quick checks:

```text
$ npx thai-address-api search "บางพลีใหน่" --limit 3
0.50  ต.บางพลีใหญ่ อ.บางพลี จ.สมุทรปราการ 10540  (Bang Phli Yai, Bang Phli, Samut Prakan 10540)
0.40  ต.บางพลีน้อย อ.บางบ่อ จ.สมุทรปราการ 10560  (Bang Phli Noi, Bang Bo, Samut Prakan 10560)

$ npx thai-address-api postcode 10540
ต.บางแก้ว อ.บางพลี จ.สมุทรปราการ 10540
ต.บางโฉลง อ.บางพลี จ.สมุทรปราการ 10540
...
```

## Examples

| File | What it shows |
| --- | --- |
| [examples/library.ts](examples/library.ts) | Parse, format, search, postcode and reverse lookup in a few lines |
| [examples/autocomplete.html](examples/autocomplete.html) | A plain HTML/JS autocomplete field against the API, keyboard accessible |
| [examples/react/AddressAutocomplete.tsx](examples/react/AddressAutocomplete.tsx) | The same as a React component with debouncing and request cancelling |
| [examples/hono-mount.ts](examples/hono-mount.ts) | Mounting the API under `/address` in an existing Hono app |
| [examples/curl.sh](examples/curl.sh) | Every endpoint with curl |

The browser demo is the same page the server shows at `/`, built as static files with `npm run demo:build` (output in `site/`). It bundles the whole library and dataset into one `demo.js` of about 190 KB gzipped, which is also a fair estimate of what the library adds to a frontend bundle.

## HTTP API

Start it with `npx thai-address-api`, Docker, or Cloudflare Workers (see [Running the server](#running-the-server)). The interactive reference is at `/docs` and the OpenAPI 3.1 document at `/openapi.json`.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/v1/regions` | The six regions |
| GET | `/v1/provinces?regionId=` | Provinces, sorted by Thai name |
| GET | `/v1/provinces/:id` | One province (`id` is the 2-digit code, e.g. `10`) |
| GET | `/v1/provinces/:id/districts` | Districts in a province |
| GET | `/v1/districts/:id` | One district with its province |
| GET | `/v1/districts/:id/sub-districts` | Sub-districts in a district |
| GET | `/v1/sub-districts/:id` | One sub-district with its district and province |
| GET | `/v1/postcodes/:code` | Every area that uses a postcode |
| GET | `/v1/search?q=&type=&limit=&provinceId=&districtId=` | Autocomplete |
| GET, POST | `/v1/parse` | Parse `?text=` or a JSON body `{"text": "..."}` |
| GET | `/v1/reverse?lat=&lng=&limit=&maxKm=` | Nearest sub-districts to a coordinate |
| GET | `/health` | Status, version and data commit |

Successful responses are `{ "data": ... }`. Errors always look like this, with codes `BAD_REQUEST`, `NOT_FOUND`, `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE` or `INTERNAL_ERROR`:

```json
{ "error": { "code": "BAD_REQUEST", "message": "Postcode must be 5 digits" } }
```

GET responses carry an `ETag` and `Cache-Control: public, max-age=86400`, so a CDN in front of it does most of the work. Input is limited: `q` to 100 characters, `text` to 500, and POST bodies to 8 KB.

## Library reference

| Function | Returns |
| --- | --- |
| `parseAddress(text)` | `ParsedAddress`: `houseNo`, `moo`, `village`, `soi`, `road`, `subDistrict`, `district`, `province`, `postcode`, `phone`, `rest`, `confidence`, `warnings`, `candidates` |
| `search(query, { type, limit, provinceId, districtId })` | `SearchResult[]` with `labelTh`/`labelEn` ready to display |
| `formatAddress(parts, { lang: 'th' \| 'en', style: 'full' \| 'short' })` | A formatted address string. Accepts a `ParsedAddress`, an `Area`, or ids |
| `lookupPostcode(code)` | `Area[]` |
| `reverseGeocode(lat, lng, { limit, maxDistanceKm })` | `NearbyArea[]`, nearest first |
| `listRegions()`, `listProvinces(regionId?)`, `listDistricts(provinceId?)`, `listSubDistricts(districtId?)` | Arrays sorted by Thai name |
| `getProvince(id)`, `getDistrict(id)`, `getSubDistrict(id)`, `getArea(subDistrictId)` | One item or `undefined` |
| `normalize(text)` | The text cleanup used internally: Thai digits, broken `ำ`, misordered tone marks |
| `createApp(options)` from `thai-address-api/server` | A Hono app you can serve or mount |

Ids are the official DOPA codes: provinces have 2 digits (`10` Bangkok), districts 4 (`1001`), sub-districts 6 (`100101`). That makes them easy to join with government data.

`warnings[].code` is one of `FUZZY_MATCH` (a name was corrected), `POSTCODE_MISMATCH`, `UNKNOWN_POSTCODE`, `CONFLICT` (a labelled part does not fit the rest), `INFERRED` (sub-district filled in from the postcode), `AMBIGUOUS` (see `candidates`) and `NOT_FOUND`.

A practical rule: accept results with `confidence >= 0.85` and no warnings, and ask the user to confirm anything else.

## Running the server

```text
thai-address-api [serve] [--port 3000] [--host 0.0.0.0] [--cors <origins>] [--quiet]
thai-address-api parse "<address>"
thai-address-api search "<query>" [--limit 10]
thai-address-api postcode <code>
```

`PORT`, `HOST` and `CORS_ORIGINS` (comma-separated) also work as environment variables.

**Docker**

```bash
docker build -t thai-address-api .
docker run -p 3000:3000 thai-address-api
```

**Cloudflare Workers**

```bash
npx wrangler deploy
```

The entry is [src/server/worker.ts](src/server/worker.ts). The bundle is about 230 KB gzipped, well under the free plan limit. The free plan also caps CPU time at 10 ms per request: lookups and search fit easily, parsing usually does, but long or messy addresses can go over.

**Inside your own app**

```ts
import { createApp } from 'thai-address-api/server'

app.route('/address', createApp({ ui: false, cors: ['https://shop.example'] }))
```

`createApp` options: `cors` (default `*`), `maxAge` for `Cache-Control` (default 86400 seconds), and `ui` to turn the demo page and docs off.

## How the parser works

1. Clean up the text: Thai digits, zero-width characters, `ํา` typed as two characters, tone marks typed before the vowel.
2. Take out the phone number and the postcode.
3. Split on markers such as `ต.` `ตำบล` `แขวง` `อ.` `เขต` `จ.` `ม.` `ซ.` `ถ.` (and `Moo`, `Soi`, `Road`, `Khet`, `District` in English). Markers that also appear inside place names, like `เขต` in `สนามชัยเขต` or `ถนน` in `แขวงถนนพญาไท`, are handled so they don't split the name.
4. Score every sub-district against everything found: labelled names, loose words, names glued together without spaces, and typos (edit distance on a phonetic skeleton of the name). Each sub-district is scored together with its own district, province and postcode, so the winner is always a consistent chain.
5. Report what it is unsure about through `warnings`, `confidence` and `candidates`.

## Performance

`npm run bench` on an Apple M-series laptop, Node 22:

| Operation | p50 | p95 |
| --- | --- | --- |
| `search` (autocomplete) | 2.2 ms | 4.9 ms |
| `parseAddress` | 5.3 ms | 12.5 ms |
| `reverseGeocode` | 0.2 ms | 0.6 ms |
| `lookupPostcode` | < 0.01 ms | < 0.01 ms |

Indexes are built on the first call (about 30 ms), not on import.

## Data

| | |
| --- | --- |
| Provinces | 77 |
| Districts | 928 (878 อำเภอ + 50 เขต) |
| Sub-districts | 7,436 (7,256 ตำบล + 180 แขวง) |
| Postcodes | 966 |
| Sub-districts with coordinates | 7,422 |

Names, codes and postcodes come from [kongvut/thai-province-data](https://github.com/kongvut/thai-province-data) at a pinned commit. Coordinates are the centre points of the sub-district polygons in OCHA's [COD-AB boundaries](https://data.humdata.org/dataset/cod-ab-tha), because the upstream points are missing for all of Bangkok. What the build changes, and how to update it, is in [data/README.md](data/README.md).

```bash
npm run data:build -- --latest   # pull the newest upstream commit
npm test                         # the data tests check exact counts, so changes show up here
```

## Limitations

- One postcode per sub-district. A few sub-districts are served by more than one post office in reality. The parser warns on a mismatch rather than rejecting it.
- Reverse geocoding measures distance to the centre of each sub-district, not to its boundary, so points near a border can land in the neighbour. 14 sub-districts created after the boundary data was published (13 of them in Bangkok) have no coordinates.
- Free-text parts such as soi, road and village names are kept as typed. English formatting translates the administrative names only.
- `confidence` is a heuristic. It is stable and useful for deciding when to ask the user, but it is not a probability.

## Contributing

Bug reports with an address that parses wrongly are very welcome, they turn straight into test cases. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Acknowledgements

- [kongvut/thai-province-data](https://github.com/kongvut/thai-province-data) by Kongvut Sangkla (MIT) for the province, district and sub-district data.
- [Thailand - Subnational Administrative Boundaries](https://data.humdata.org/dataset/cod-ab-tha), Royal Thai Survey Department via OCHA (CC BY-IGO 3.0), for the coordinates.

Their license texts and the list of changes are in [NOTICE](NOTICE).

## License

[MIT](LICENSE)
