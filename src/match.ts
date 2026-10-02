import type { Keys } from './db'
import { editDistance, isThai, toKey, toSkeleton, typoBudget } from './text'

export interface Query {
  raw: string
  key: string
  skel: string
  thai: boolean
  digits: boolean
}

export function toQuery(raw: string): Query {
  const key = toKey(raw)
  return { raw, key, skel: toSkeleton(key), thai: isThai(key), digits: /^\d+$/.test(key) }
}

export type MatchKind = 'exact' | 'alias' | 'variant' | 'abbreviation' | 'contains' | 'fuzzy'

export interface Match {
  score: number
  kind: MatchKind
}

/** Common names people use for a province instead of the official one. */
export const PROVINCE_ALIASES: Record<number, string[]> = {
  10: ['กทม', 'กรุงเทพ', 'bkk', 'krungthep'],
  12: ['นนท์'],
  14: ['อยุธยา', 'ayutthaya', 'ayudhya'],
  30: ['โคราช', 'korat'],
  34: ['อุบล', 'ubon'],
  41: ['อุดร', 'udon'],
  80: ['นครศรี', 'nakhonsi'],
  84: ['สุราษฎร์', 'surat'],
}

function pick(q: Query, k: Keys): [key: string, skel: string] {
  return q.thai ? [k.th, k.thSkel] : [k.en, k.enSkel]
}

/** Score for autocomplete, where the query is usually the start of a name. */
export function prefixScore(q: Query, k: Keys, aliases?: string[]): number {
  if (!q.key || q.digits) return 0
  const [key, skel] = pick(q, k)
  if (key === q.key) return 1
  if (key.startsWith(q.key)) return 0.9 + 0.05 * (q.key.length / key.length)
  if (aliases?.includes(q.key)) return 1
  if (aliases?.some((a) => a.startsWith(q.key))) return 0.9
  if (skel === q.skel) return 0.88
  if (skel.startsWith(q.skel)) return 0.8 + 0.05 * (q.skel.length / skel.length)
  if (q.key.length >= 2 && key.includes(q.key)) return 0.7
  const budget = typoBudget(q.skel.length)
  if (budget === 0) return 0
  const d = editDistance(q.skel, skel, budget, 'prefix')
  return d <= budget ? 0.6 - 0.1 * d : 0
}

/** Score for a value that should be the whole name, as in "ต.บางพลีใหญ่". */
export function fullMatch(q: Query, k: Keys, aliases?: string[]): Match | null {
  if (!q.key || q.digits) return null
  const [key, skel] = pick(q, k)
  if (key === q.key) return { score: 1, kind: 'exact' }
  if (aliases?.includes(q.key)) return { score: 1, kind: 'alias' }
  // In Latin script the skeleton only folds romanisation differences (Lumpini/Lumphini), not typos.
  if (skel === q.skel) return { score: 0.9, kind: q.thai ? 'fuzzy' : 'variant' }
  const budget = typoBudget(q.skel.length)
  if (budget > 0) {
    const d = editDistance(q.skel, skel, budget)
    if (d <= budget) return { score: 0.8 - 0.1 * d, kind: 'fuzzy' }
  }
  if (q.key.length >= 3 && key.startsWith(q.key)) return { score: 0.6, kind: 'abbreviation' }
  return null
}
