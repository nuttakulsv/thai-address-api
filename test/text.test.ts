import { describe, expect, it } from 'vitest'
import { editDistance, normalize, toKey, toSkeleton } from '../src/text'

describe('normalize', () => {
  it('converts Thai digits', () => expect(normalize('๑๐๕๔๐')).toBe('10540'))
  it('repairs sara am typed as nikhahit + sara aa', () => expect(normalize('นํ้า')).toBe('น้ำ'))
  it('puts the tone mark after the vowel', () => expect(normalize('ท่ี')).toBe('ที่'))
  it('drops repeated marks and zero-width characters', () => expect(normalize('บ้้าน​')).toBe('บ้าน'))
  it('collapses whitespace and lower-cases', () => expect(normalize('  Bang   PHLI ')).toBe('bang phli'))
})

describe('toKey / toSkeleton', () => {
  it('removes spacing, punctuation and ฯ', () => {
    expect(toKey('กรุงเทพฯ')).toBe('กรุงเทพ')
    expect(toKey('Pathum Wan')).toBe('pathumwan')
    expect(toKey('สุไหงโก-ลก')).toBe('สุไหงโกลก')
  })
  it('folds letters people mix up', () => {
    expect(toSkeleton(toKey('ใหญ่'))).toBe(toSkeleton(toKey('ไหย')))
    expect(toSkeleton(toKey('ศรี'))).toBe(toSkeleton(toKey('สรี')))
  })
  it('folds romanisation differences', () => {
    expect(toSkeleton('lumpini')).toBe(toSkeleton('lumphini'))
    expect(toSkeleton('muang')).toBe(toSkeleton('mueang'))
  })
})

describe('editDistance', () => {
  it('counts edits and transpositions', () => {
    expect(editDistance('kitten', 'sitting', 5)).toBe(3)
    expect(editDistance('abcd', 'acbd', 3)).toBe(1)
  })
  it('stops at the bound', () => expect(editDistance('abc', 'xyzxyz', 1)).toBe(2))
  it('supports prefix and substring modes', () => {
    expect(editDistance('bangp', 'bangphliyai', 0, 'prefix')).toBe(0)
    expect(editDistance('phli', 'bangphliyai', 0, 'substring')).toBe(0)
    expect(editDistance('phlj', 'bangphliyai', 1, 'substring')).toBe(1)
  })
})
