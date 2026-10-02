const t0 = performance.now()
const lib = await import('../src/index')
const imported = performance.now() - t0
const t1 = performance.now()
lib.search('ก')
const indexed = performance.now() - t1

function measure(name: string, inputs: string[], fn: (input: string) => unknown, rounds: number) {
  const times: number[] = []
  for (let r = 0; r < rounds; r++) {
    for (const input of inputs) {
      const start = performance.now()
      fn(input)
      times.push(performance.now() - start)
    }
  }
  times.sort((a, b) => a - b)
  const at = (p: number) => times[Math.min(times.length - 1, Math.floor(times.length * p))]!.toFixed(2)
  console.log(`| ${name.padEnd(22)} | ${at(0.5).padStart(7)} | ${at(0.95).padStart(7)} | ${at(0.99).padStart(7)} |`)
}

const queries = ['บ', 'บาง', 'บางพลี', 'บางพลีใหน่', 'ลุมพิ', 'หนองบัว ขอนแก่น', 'pathum', 'chiang mai', '105', 'กทม']
const addresses = [
  '99/1 ม.4 ต.บางพลีใหญ่ อ.บางพลี จ.สมุทรปราการ 10540',
  '99/1ม.4ต.บางพลีใหญ่อ.บางพลีจ.สมุทรปราการ10540',
  'บางพลีใหน่ บางพลี สมุทรปราการ 10540',
  'คุณสมชาย ใจดี 55/3 ซ.สุขุมวิท 101/1 แขวงบางจาก เขตพระโขนง กทม 10260 โทร 081-234-5678',
  '99/1 Moo 4, Bang Phli Yai, Bang Phli, Samut Prakan 10540',
]
const points: [number, number][] = [
  [13.7466, 100.5393],
  [18.7883, 98.9853],
  [7.8846, 98.3923],
]

console.log(`Node ${process.version}, ${process.platform}/${process.arch}`)
console.log(`import ${imported.toFixed(1)} ms, first call (builds indexes) ${indexed.toFixed(1)} ms\n`)
console.log('| operation              |  p50 ms |  p95 ms |  p99 ms |')
console.log('|------------------------|--------:|--------:|--------:|')
measure('search (autocomplete)', queries, (q) => lib.search(q), 50)
measure('parseAddress', addresses, (a) => lib.parseAddress(a), 50)
measure('lookupPostcode', ['10540', '10330', '50200'], (p) => lib.lookupPostcode(p), 500)
measure('reverseGeocode', ['0', '1', '2'], (i) => lib.reverseGeocode(...points[Number(i)]!), 200)

export {}
