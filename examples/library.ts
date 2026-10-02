// npx tsx examples/library.ts   (run `npm run build` first)
import { formatAddress, lookupPostcode, parseAddress, reverseGeocode, search } from 'thai-address-api'

const parsed = parseAddress('คุณสมชาย 55/3 ซ.สุขุมวิท 101/1 แขวงบางจาก เขตพระโขนง กทม 10260 โทร 081-234-5678')
console.log('parse   ', parsed.subDistrict?.nameTh, parsed.district?.nameTh, parsed.province?.nameTh, parsed.postcode)
console.log('        ', `phone=${parsed.phone} rest="${parsed.rest}" confidence=${parsed.confidence}`)
console.log('format  ', formatAddress(parsed))
console.log('format  ', formatAddress(parsed, { lang: 'en' }))

console.log('search  ', search('บางพลีใหน่', { limit: 1 })[0]?.labelTh)
console.log(
  'postcode',
  lookupPostcode('10330')
    .map((a) => a.subDistrict.nameTh)
    .join(', '),
)

const [here] = reverseGeocode(18.7883, 98.9853)
console.log('reverse ', here && formatAddress(here, { style: 'short' }), `(${here?.distanceKm} km from centre)`)
