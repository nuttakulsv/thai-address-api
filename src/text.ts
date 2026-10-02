const TONE_MARKS = /[่-์็]/g

const CONFUSABLE: Record<string, string> = {
  ใ: 'ไ',
  ศ: 'ส',
  ษ: 'ส',
  ณ: 'น',
  ญ: 'ย',
  ฎ: 'ด',
  ฏ: 'ต',
  ฐ: 'ท',
  ฑ: 'ท',
  ฒ: 'ท',
  ธ: 'ท',
  ภ: 'พ',
  ฆ: 'ค',
  ฌ: 'ช',
  ฬ: 'ล',
  ฅ: 'ค',
  ฃ: 'ข',
}
const CONFUSABLE_RE = new RegExp(`[${Object.keys(CONFUSABLE).join('')}]`, 'g')

/** Unicode cleanup that keeps case and spacing: Thai digits, broken sara am, misordered tone marks. */
export function cleanText(input: string): string {
  return input
    .normalize('NFC')
    .replace(/[​-‍⁠﻿]/g, '')
    .replace(/[๐-๙]/g, (d) => String(d.charCodeAt(0) - 0x0e50))
    .replace(/ํ([่-๋]?)า/g, '$1ำ')
    .replace(/([่-๋])([ัิ-ู็])/g, '$2$1')
    .replace(/([ั-ฺ็-๎])\1+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalize(input: string): string {
  return cleanText(input).toLowerCase()
}

/** Comparable form: letters, marks and digits only. "กรุงเทพฯ" -> "กรุงเทพ", "Pathum Wan" -> "pathumwan". */
export function toKey(input: string): string {
  return normalize(input)
    .replace(/ฯ/g, '')
    .replace(/[^\p{L}\p{M}\p{N}]/gu, '')
}

/** Looser form used for typo tolerance: drops tone marks and folds letters that sound alike. */
export function toSkeleton(key: string): string {
  if (isThai(key)) return key.replace(TONE_MARKS, '').replace(CONFUSABLE_RE, (c) => CONFUSABLE[c]!)
  return key
    .replace(/([ptkc])h/g, '$1')
    .replace(/ue/g, 'u')
    .replace(/(.)\1+/g, '$1')
}

export function isThai(s: string): boolean {
  return /[ก-๛]/.test(s)
}

export function hasLatin(s: string): boolean {
  return /[a-z]/i.test(s)
}

/**
 * Optimal string alignment distance between `pattern` and `text`.
 * mode "full" compares whole strings, "prefix" finds the best prefix of text,
 * "substring" finds the best match anywhere in text. Returns max + 1 once the bound is exceeded.
 */
export function editDistance(
  pattern: string,
  text: string,
  max: number,
  mode: 'full' | 'prefix' | 'substring' = 'full',
): number {
  const m = pattern.length
  const n = text.length
  if (mode === 'full' && Math.abs(m - n) > max) return max + 1
  if (m === 0) return mode === 'full' ? Math.min(n, max + 1) : 0

  let prev2 = new Int32Array(n + 1)
  let prev = new Int32Array(n + 1)
  let cur = new Int32Array(n + 1)
  for (let j = 0; j <= n; j++) prev[j] = mode === 'substring' ? 0 : j

  for (let i = 1; i <= m; i++) {
    cur[0] = i
    let rowMin = cur[0]
    const pc = pattern.charCodeAt(i - 1)
    for (let j = 1; j <= n; j++) {
      const tc = text.charCodeAt(j - 1)
      const cost = pc === tc ? 0 : 1
      let v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost)
      if (i > 1 && j > 1 && pc === text.charCodeAt(j - 2) && pattern.charCodeAt(i - 2) === tc) {
        v = Math.min(v, prev2[j - 2]! + 1)
      }
      cur[j] = v
      if (v < rowMin) rowMin = v
    }
    if (rowMin > max) return max + 1
    ;[prev2, prev, cur] = [prev, cur, prev2]
  }

  const best = mode === 'full' ? prev[n]! : Math.min(...prev)
  return best > max ? max + 1 : best
}

/** Typos allowed for a query of this length. Short strings get none, otherwise everything matches. */
export function typoBudget(length: number): number {
  if (length < 4) return 0
  if (length < 8) return 1
  return 2
}
