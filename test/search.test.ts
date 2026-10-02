import { describe, expect, it } from 'vitest'
import { search } from '../src/index'

const first = (q: string, options = {}) => search(q, options)[0]

describe('search', () => {
  it('finds a sub-district despite a typo', () => {
    expect(first('บางพลีใหน่')).toMatchObject({ type: 'subDistrict', nameTh: 'บางพลีใหญ่' })
  })

  it('completes a prefix', () => {
    expect(first('ลุมพิ')?.labelTh).toBe('แขวงลุมพินี เขตปทุมวัน กรุงเทพฯ 10330')
  })

  it('ranks the exact name first and the larger area before the smaller one', () => {
    const [a, b] = search('ปทุมวัน')
    expect(a).toMatchObject({ type: 'district', nameTh: 'ปทุมวัน' })
    expect(b).toMatchObject({ type: 'subDistrict', nameTh: 'ปทุมวัน' })
  })

  it('narrows a common name with a second word', () => {
    const results = search('หนองบัว ขอนแก่น')
    expect(results.length).toBeGreaterThan(0)
    expect(results.every((r) => r.province.nameTh === 'ขอนแก่น' && r.nameTh === 'หนองบัว')).toBe(true)
  })

  it('accepts English, with or without spaces', () => {
    expect(first('pathumwan')?.nameTh).toBe('ปทุมวัน')
    expect(first('Bang Phli Yai')?.nameTh).toBe('บางพลีใหญ่')
    expect(first('chiang mai', { type: 'province' })?.nameTh).toBe('เชียงใหม่')
  })

  it('knows common province nicknames', () => {
    expect(first('กทม')?.nameTh).toBe('กรุงเทพมหานคร')
    expect(first('โคราช')?.nameTh).toBe('นครราชสีมา')
  })

  it('searches by postcode prefix', () => {
    const results = search('1054', { limit: 50 })
    expect(results.length).toBeGreaterThan(0)
    expect(results.every((r) => r.subDistrict?.postcode.startsWith('1054'))).toBe(true)
    expect(search('บางพลี 10540', { type: 'subDistrict' })[0]?.nameTh).toBe('บางพลีใหญ่')
  })

  it('respects type, limit and parent filters', () => {
    expect(search('บาง', { type: 'district', limit: 5 }).every((r) => r.type === 'district')).toBe(true)
    expect(search('บาง', { limit: 3 })).toHaveLength(3)
    expect(search('บาง', { provinceId: 11 }).every((r) => r.province.id === 11)).toBe(true)
    expect(search('บาง', { districtId: 1103 }).every((r) => r.district?.id === 1103)).toBe(true)
  })

  it('returns nothing for empty or unrelated input', () => {
    expect(search('')).toEqual([])
    expect(search('   ')).toEqual([])
    expect(search('zzzzzzzz')).toEqual([])
  })
})
