import { describe, expect, it } from 'vitest'
import { listSubDistricts, lookupPostcode, parseAddress, type ParsedAddress } from '../src/index'

interface Expected {
  sub?: string | null
  district?: string | null
  province?: string | null
  postcode?: string | null
  houseNo?: string
  moo?: string
  soi?: string
  road?: string
  village?: string
  phone?: string
  rest?: string
  warnings?: string[]
  minConfidence?: number
  maxConfidence?: number
}

function check(r: ParsedAddress, e: Expected) {
  if (e.sub !== undefined) expect(r.subDistrict?.nameTh ?? null).toBe(e.sub)
  if (e.district !== undefined) expect(r.district?.nameTh ?? null).toBe(e.district)
  if (e.province !== undefined) expect(r.province?.nameTh ?? null).toBe(e.province)
  if (e.postcode !== undefined) expect(r.postcode).toBe(e.postcode)
  for (const key of ['houseNo', 'moo', 'soi', 'road', 'village', 'phone', 'rest'] as const) {
    if (e[key] !== undefined) expect(r[key]).toBe(e[key])
  }
  const codes = r.warnings.map((w) => w.code)
  expect(codes.sort()).toEqual([...(e.warnings ?? [])].sort())
  if (e.minConfidence !== undefined) expect(r.confidence).toBeGreaterThanOrEqual(e.minConfidence)
  if (e.maxConfidence !== undefined) expect(r.confidence).toBeLessThanOrEqual(e.maxConfidence)
}

const BANG_PHLI = { sub: 'บางพลีใหญ่', district: 'บางพลี', province: 'สมุทรปราการ', postcode: '10540' }
const LUMPHINI = { sub: 'ลุมพินี', district: 'ปทุมวัน', province: 'กรุงเทพมหานคร', postcode: '10330' }

const cases: [string, string, Expected][] = [
  [
    'short markers',
    '99/1 ม.4 ต.บางพลีใหญ่ อ.บางพลี จ.สมุทรปราการ 10540',
    { ...BANG_PHLI, houseNo: '99/1', moo: '4', minConfidence: 0.99 },
  ],
  [
    'no spaces at all',
    '99/1ม.4ต.บางพลีใหญ่อ.บางพลีจ.สมุทรปราการ10540',
    { ...BANG_PHLI, houseNo: '99/1', moo: '4', minConfidence: 0.99 },
  ],
  [
    'full words',
    'บ้านเลขที่ 12 หมู่ที่ 3 ตำบลบางพลีใหญ่ อำเภอบางพลี จังหวัดสมุทรปราการ 10540',
    { ...BANG_PHLI, houseNo: '12', moo: '3' },
  ],
  ['full words, no spaces', 'ตำบลบางพลีใหญ่อำเภอบางพลีจังหวัดสมุทรปราการ', { ...BANG_PHLI }],
  ['commas', 'ต.บางพลีใหญ่, อ.บางพลี, จ.สมุทรปราการ, 10540', { ...BANG_PHLI }],
  [
    'several lines',
    '99/1 ม.4\nต.บางพลีใหญ่ อ.บางพลี\nจ.สมุทรปราการ 10540',
    { ...BANG_PHLI, houseNo: '99/1', moo: '4' },
  ],
  ['no markers', 'บางพลีใหญ่ บางพลี สมุทรปราการ 10540', { ...BANG_PHLI, minConfidence: 0.85 }],
  ['no markers, no spaces', 'บางพลีใหญ่บางพลีสมุทรปราการ10540', { ...BANG_PHLI }],
  [
    'typo without marker',
    'บางพลีใหน่ บางพลี สมุทรปราการ 10540',
    { ...BANG_PHLI, warnings: ['FUZZY_MATCH'], maxConfidence: 0.95 },
  ],
  ['typo with marker', 'ต.บางพลีใหน่ อ.บางพลี จ.สมุทรปราการ', { ...BANG_PHLI, warnings: ['FUZZY_MATCH'] }],
  ['typo glued to other names', 'บางพลีใหน่บางพลีสมุทรปราการ10540', { ...BANG_PHLI, warnings: ['FUZZY_MATCH'] }],
  ['sub-district and postcode only', 'บางพลีใหญ่ 10540', { ...BANG_PHLI }],
  ['sub-district and province only', 'ต.บางพลีใหญ่ จ.สมุทรปราการ', { ...BANG_PHLI }],
  [
    'Thai digits',
    '๙๙ หมู่ที่ ๓ ตำบลสามตำบล อำเภอจุฬาภรณ์ จังหวัดนครศรีธรรมราช ๘๐๑๓๐',
    { sub: 'สามตำบล', district: 'จุฬาภรณ์', houseNo: '99', moo: '3', postcode: '80130' },
  ],
  [
    'Bangkok with กทม.',
    '123 ถ.วิทยุ แขวงลุมพินี เขตปทุมวัน กทม. 10330',
    { ...LUMPHINI, houseNo: '123', road: 'วิทยุ' },
  ],
  ['Bangkok with กรุงเทพฯ', 'แขวงลุมพินี เขตปทุมวัน กรุงเทพฯ 10330', { ...LUMPHINI }],
  ['Bangkok without markers', 'ลุมพินี ปทุมวัน กทม 10330', { ...LUMPHINI }],
  [
    'marker word inside a name, with space',
    'แขวง ถนนพญาไท เขตราชเทวี กรุงเทพมหานคร 10400',
    { sub: 'ถนนพญาไท', district: 'ราชเทวี', road: undefined },
  ],
  ['marker word inside a name, no space', 'แขวงถนนพญาไท เขตราชเทวี', { sub: 'ถนนพญาไท', district: 'ราชเทวี' }],
  ['เขต at the end of a name', 'ต.คีรีเขต อ.ธารโต จ.ยะลา', { sub: 'คีรีเขต', district: 'ธารโต' }],
  [
    'district named with เขต',
    'อ.สนามชัยเขต จ.ฉะเชิงเทรา',
    { sub: null, district: 'สนามชัยเขต', province: 'ฉะเชิงเทรา' },
  ],
  ['dotted name', 'ต.จ.ป.ร. อ.กระบุรี จ.ระนอง 85110', { sub: 'จ.ป.ร.', district: 'กระบุรี', province: 'ระนอง' }],
  [
    'hyphenated name',
    'ต.สุไหงโก-ลก อ.สุไหงโก-ลก จ.นราธิวาส 96120',
    { sub: 'สุไหงโก-ลก', district: 'สุไหงโก-ลก', province: 'นราธิวาส' },
  ],
  [
    'อ.เมือง shorthand',
    'ต.ในเมือง อ.เมือง จ.ขอนแก่น 40000',
    { sub: 'ในเมือง', district: 'เมืองขอนแก่น', province: 'ขอนแก่น' },
  ],
  [
    'อ.เมือง with postcode only',
    'ต.ในเมือง อ.เมือง 40000',
    { sub: 'ในเมือง', district: 'เมืองขอนแก่น', province: 'ขอนแก่น' },
  ],
  ['province nickname โคราช', 'ต.ในเมือง อ.เมืองนครราชสีมา จ.โคราช', { sub: 'ในเมือง', province: 'นครราชสีมา' }],
  ['province nickname อยุธยา', 'ต.ประตูชัย อ.พระนครศรีอยุธยา อยุธยา', { sub: 'ประตูชัย', province: 'พระนครศรีอยุธยา' }],
  [
    'duplicate district name',
    'อ.เฉลิมพระเกียรติ จ.นครราชสีมา',
    { sub: null, district: 'เฉลิมพระเกียรติ', province: 'นครราชสีมา' },
  ],
  [
    'district and province only',
    'อ.บางพลี จ.สมุทรปราการ',
    { sub: null, district: 'บางพลี', province: 'สมุทรปราการ', maxConfidence: 0.8 },
  ],
  ['ambiguous sub-district', 'ต.หนองบัว', { sub: null, warnings: ['AMBIGUOUS'] }],
  ['sub-district narrowed by province', 'ต.หนองบัว จ.ขอนแก่น', { sub: 'หนองบัว', province: 'ขอนแก่น' }],
  [
    'wrong postcode',
    'ต.บางพลีใหญ่ อ.บางพลี จ.สมุทรปราการ 10560',
    { ...BANG_PHLI, warnings: ['POSTCODE_MISMATCH'], maxConfidence: 0.9 },
  ],
  ['unknown postcode', 'ต.บางพลีใหญ่ อ.บางพลี จ.สมุทรปราการ 19999', { ...BANG_PHLI, warnings: ['UNKNOWN_POSTCODE'] }],
  [
    'province that does not fit',
    'ต.บางพลีใหญ่ อ.บางพลี จ.ชลบุรี 10540',
    { ...BANG_PHLI, warnings: ['CONFLICT'], maxConfidence: 0.9 },
  ],
  [
    'soi with branch and road',
    'เลขที่ 88 ซอยลาดพร้าว 101 แยก 3 ถนนลาดพร้าว แขวงคลองจั่น เขตบางกะปิ กรุงเทพฯ 10240',
    { sub: 'คลองจั่น', district: 'บางกะปิ', houseNo: '88', soi: 'ลาดพร้าว 101 แยก 3', road: 'ลาดพร้าว' },
  ],
  [
    'village and moo',
    'หมู่บ้านพฤกษา 9 ม.2 ต.คลองสาม อ.คลองหลวง จ.ปทุมธานี 12120',
    { sub: 'คลองสาม', district: 'คลองหลวง', village: 'พฤกษา 9', moo: '2' },
  ],
  [
    'pasted from a chat',
    'คุณสมชาย ใจดี 55/3 ซ.สุขุมวิท 101/1 แขวงบางจาก เขตพระโขนง กทม 10260 โทร 081-234-5678',
    {
      sub: 'บางจาก',
      district: 'พระโขนง',
      houseNo: '55/3',
      soi: 'สุขุมวิท 101/1',
      phone: '0812345678',
      rest: 'คุณสมชาย ใจดี',
    },
  ],
  [
    'international phone format',
    'ต.บางพลีใหญ่ อ.บางพลี จ.สมุทรปราการ 10540 tel: +66 81 234 5678',
    { ...BANG_PHLI, phone: '0812345678' },
  ],
  ['landline', 'แขวงลุมพินี เขตปทุมวัน กทม. 10330 โทร. 02-123-4567', { ...LUMPHINI, phone: '021234567' }],
  ['English', '99/1 Moo 4, Bang Phli Yai, Bang Phli, Samut Prakan 10540', { ...BANG_PHLI, houseNo: '99/1', moo: '4' }],
  ['English, upper case', 'BANG PHLI YAI, BANG PHLI, SAMUT PRAKAN', { ...BANG_PHLI }],
  ['English, other spelling', 'Lumpini, Pathumwan, BKK 10330', { ...LUMPHINI }],
  ['English with level words', 'Khwaeng Lumphini, Khet Pathum Wan, Bangkok', { ...LUMPHINI }],
  ['English with suffixes', 'Bang Phli Yai Subdistrict, Bang Phli District, Samut Prakan Province', { ...BANG_PHLI }],
  [
    'English road and soi',
    '1 Soi Sukhumvit 101/1, Sukhumvit Rd, Bang Chak, Phra Khanong, Bangkok 10260',
    { sub: 'บางจาก', soi: 'Sukhumvit 101/1', road: 'Sukhumvit', houseNo: '1' },
  ],
  ['broken sara am', 'ต.ปากนํ้า อ.เมืองสมุทรปราการ', { sub: 'ปากน้ำ', district: 'เมืองสมุทรปราการ' }],
  [
    'nothing recognisable',
    'hello world',
    { sub: null, district: null, province: null, rest: 'hello world', warnings: ['NOT_FOUND'], maxConfidence: 0 },
  ],
  ['empty', '', { sub: null, province: null, warnings: ['NOT_FOUND'], maxConfidence: 0 }],
]

describe('parseAddress', () => {
  it.each(cases)('%s', (_, input, expected) => check(parseAddress(input), expected))

  it('infers the sub-district from a postcode used by only one area', () => {
    const unique = listSubDistricts().find((s) => lookupPostcode(s.postcode).length === 1)!
    const r = parseAddress(unique.postcode)
    expect(r.subDistrict?.id).toBe(unique.id)
    expect(r.warnings.map((w) => w.code)).toEqual(['INFERRED'])
  })

  it('lists candidates for ambiguous input', () => {
    const r = parseAddress('ต.หนองบัว')
    expect(r.candidates.length).toBe(5)
    expect(new Set(r.candidates.map((c) => c.subDistrict.nameTh))).toEqual(new Set(['หนองบัว']))
  })

  it('names the corrected text in the warning', () => {
    const [w] = parseAddress('บางพลีใหน่ บางพลี สมุทรปราการ').warnings
    expect(w?.message).toContain('บางพลีใหน่')
    expect(w?.message).toContain('บางพลีใหญ่')
  })

  it('handles very long input without throwing', () => {
    const r = parseAddress('ต.บางพลีใหญ่ อ.บางพลี จ.สมุทรปราการ '.repeat(200))
    expect(r.subDistrict?.nameTh).toBe('บางพลีใหญ่')
  })

  it('does not mistake a phone number for a postcode or house number', () => {
    const r = parseAddress('0812345678 ต.บางพลีใหญ่ อ.บางพลี')
    expect(r.phone).toBe('0812345678')
    expect(r.houseNo).toBeNull()
    expect(r.postcode).toBe('10540')
  })
})
