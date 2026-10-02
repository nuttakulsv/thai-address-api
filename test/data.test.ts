import { describe, expect, it } from 'vitest'
import {
  DATA_SOURCE,
  getArea,
  getDistrict,
  getProvince,
  listDistricts,
  listProvinces,
  listRegions,
  listSubDistricts,
  lookupPostcode,
} from '../src/index'

describe('dataset', () => {
  it('has the expected number of areas', () => {
    expect(listRegions()).toHaveLength(6)
    expect(listProvinces()).toHaveLength(77)
    expect(listDistricts()).toHaveLength(928)
    expect(listSubDistricts()).toHaveLength(7436)
    expect(new Set(listSubDistricts().map((s) => s.postcode)).size).toBe(966)
  })

  it('splits Bangkok and the rest the way DOPA does', () => {
    expect(listDistricts(10)).toHaveLength(50)
    expect(listSubDistricts().filter((s) => s.provinceId === 10)).toHaveLength(180)
  })

  it('links every level to its parent', () => {
    for (const d of listDistricts()) expect(getProvince(d.provinceId)).toBeDefined()
    for (const s of listSubDistricts()) {
      const district = getDistrict(s.districtId)
      expect(district?.provinceId).toBe(s.provinceId)
    }
    for (const d of listDistricts()) expect(listSubDistricts(d.id).length).toBeGreaterThan(0)
  })

  it('uses DOPA codes as ids', () => {
    expect(getProvince(10)?.nameEn).toBe('Bangkok')
    expect(getProvince(38)?.nameTh).toBe('บึงกาฬ')
    expect(getArea(100101)).toMatchObject({
      subDistrict: { nameTh: 'พระบรมมหาราชวัง', postcode: '10200' },
      district: { id: 1001, nameTh: 'พระนคร' },
      province: { id: 10 },
    })
  })

  it('has clean names and valid postcodes', () => {
    for (const s of listSubDistricts()) {
      expect(s.postcode).toMatch(/^[1-9]\d{4}$/)
      expect(s.nameEn).not.toMatch(/^\*|^\s|\s$/)
      expect(s.nameTh).not.toMatch(/^\s|\s$/)
    }
  })

  it('has coordinates inside Thailand for almost every sub-district', () => {
    const withCoords = listSubDistricts().filter((s) => s.lat !== null && s.lng !== null)
    expect(withCoords).toHaveLength(7422)
    for (const s of withCoords) {
      expect(s.lat).toBeGreaterThan(5.5)
      expect(s.lat).toBeLessThan(20.5)
      expect(s.lng).toBeGreaterThan(97.3)
      expect(s.lng).toBeLessThan(105.7)
    }
  })

  it('sorts lists by Thai name', () => {
    const names = listProvinces().map((p) => p.nameTh)
    expect(names).toEqual([...names].sort(new Intl.Collator('th').compare))
    expect(names[0]).toBe('กระบี่')
  })

  it('filters provinces by region', () => {
    expect(listProvinces(6).every((p) => p.regionId === 6)).toBe(true)
    expect(listProvinces().length).toBe(listRegions().reduce((n, r) => n + listProvinces(r.id).length, 0))
  })

  it('looks up postcodes as string or number', () => {
    expect(
      lookupPostcode('10330')
        .map((a) => a.subDistrict.nameTh)
        .sort(),
    ).toEqual(['ปทุมวัน', 'รองเมือง', 'ลุมพินี', 'วังใหม่'].sort())
    expect(lookupPostcode(10330)).toHaveLength(4)
    expect(lookupPostcode('00000')).toEqual([])
  })

  it('records where the data came from', () => {
    expect(DATA_SOURCE.repo).toBe('kongvut/thai-province-data')
    expect(DATA_SOURCE.sha).toMatch(/^[0-9a-f]{40}$/)
  })
})
