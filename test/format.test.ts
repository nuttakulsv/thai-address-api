import { describe, expect, it } from 'vitest'
import { formatAddress, parseAddress, reverseGeocode } from '../src/index'

describe('formatAddress', () => {
  const upcountry = { houseNo: '99/1', moo: '4', subDistrict: 110301 }
  const bangkok = { houseNo: '123', road: 'วิทยุ', subDistrict: 100704 }

  it('writes ตำบล/อำเภอ/จังหวัด outside Bangkok', () => {
    expect(formatAddress(upcountry)).toBe('99/1 หมู่ที่ 4 ตำบลบางพลีใหญ่ อำเภอบางพลี จังหวัดสมุทรปราการ 10540')
    expect(formatAddress(upcountry, { style: 'short' })).toBe('99/1 ม.4 ต.บางพลีใหญ่ อ.บางพลี จ.สมุทรปราการ 10540')
  })

  it('writes แขวง/เขต and no จังหวัด in Bangkok', () => {
    expect(formatAddress(bangkok)).toBe('123 ถนนวิทยุ แขวงลุมพินี เขตปทุมวัน กรุงเทพมหานคร 10330')
    expect(formatAddress(bangkok, { style: 'short' })).toBe('123 ถ.วิทยุ แขวงลุมพินี เขตปทุมวัน กรุงเทพฯ 10330')
  })

  it('writes English', () => {
    expect(formatAddress(upcountry, { lang: 'en' })).toBe('99/1 Moo 4, Bang Phli Yai, Bang Phli, Samut Prakan 10540')
    expect(formatAddress({ soi: 'Sukhumvit 101/1', road: 'Sukhumvit', subDistrict: 100905 }, { lang: 'en' })).toBe(
      'Soi Sukhumvit 101/1, Sukhumvit Road, Bang Chak, Phra Khanong, Bangkok 10260',
    )
  })

  it('does not repeat prefixes the caller already wrote', () => {
    expect(formatAddress({ soi: 'ซอยลาดพร้าว 101', road: 'ถ.ลาดพร้าว', subDistrict: 110301 }, { style: 'short' })).toBe(
      'ซ.ลาดพร้าว 101 ถ.ลาดพร้าว ต.บางพลีใหญ่ อ.บางพลี จ.สมุทรปราการ 10540',
    )
  })

  it('formats partial addresses', () => {
    expect(formatAddress({ district: 1103 }, { style: 'short' })).toBe('อ.บางพลี จ.สมุทรปราการ')
    expect(formatAddress({ province: 10 })).toBe('กรุงเทพมหานคร')
    expect(formatAddress({})).toBe('')
  })

  it('round-trips a messy address into a clean one', () => {
    const parsed = parseAddress('99/1ม.4ต.บางพลีใหน่อ.บางพลีจ.สมุทรปราการ10540')
    expect(formatAddress(parsed)).toBe('99/1 หมู่ที่ 4 ตำบลบางพลีใหญ่ อำเภอบางพลี จังหวัดสมุทรปราการ 10540')
  })
})

describe('reverseGeocode', () => {
  it('finds the sub-district around a well-known place', () => {
    const [siam] = reverseGeocode(13.7466, 100.5393)
    expect(siam?.subDistrict.nameTh).toBe('ปทุมวัน')
    const [phuketTown] = reverseGeocode(7.8846, 98.3923)
    expect(phuketTown?.province.nameTh).toBe('ภูเก็ต')
  })

  it('returns several results nearest first', () => {
    const results = reverseGeocode(18.7883, 98.9853, { limit: 5 })
    expect(results).toHaveLength(5)
    const km = results.map((r) => r.distanceKm)
    expect(km).toEqual([...km].sort((a, b) => a - b))
    expect(results[0]?.province.nameTh).toBe('เชียงใหม่')
  })

  it('returns nothing far away from Thailand', () => {
    expect(reverseGeocode(35.68, 139.69)).toEqual([])
  })

  it('rejects invalid coordinates', () => {
    expect(() => reverseGeocode(91, 0)).toThrow(RangeError)
    expect(() => reverseGeocode(0, Number.NaN)).toThrow(RangeError)
  })
})
