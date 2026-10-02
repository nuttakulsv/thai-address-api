const STYLE = `
:root {
  --bg: #f6f5f1; --card: #ffffff; --text: #1d1f23; --muted: #6a6f78; --line: #e4e2dc;
  --accent: #0f766e; --accent-soft: #e6f3f1; --warn: #b45309; --warn-soft: #fdf3e6; --bad: #b91c1c;
  --radius: 14px; --shadow: 0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.05);
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #121416; --card: #1b1e21; --text: #e9e7e2; --muted: #9aa0a8; --line: #2c3035;
    --accent: #2dd4bf; --accent-soft: #15302d; --warn: #f59e0b; --warn-soft: #33270f; --bad: #f87171;
    --shadow: none;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--bg); color: var(--text);
  font: 16px/1.6 "IBM Plex Sans Thai", system-ui, sans-serif;
}
main { max-width: 980px; margin: 0 auto; padding: 32px 16px 56px; }
header { margin-bottom: 24px; }
h1 { font-size: 28px; line-height: 1.2; margin: 0 0 6px; letter-spacing: -.01em; }
header p { margin: 0; color: var(--muted); }
header .note { margin-top: 8px; font-size: 14px; }
header nav { margin-top: 12px; display: flex; gap: 16px; flex-wrap: wrap; font-size: 15px; }
a { color: var(--accent); }
.grid { display: grid; gap: 16px; grid-template-columns: 1fr; }
@media (min-width: 860px) { .grid { grid-template-columns: 1.15fr .85fr; } .wide { grid-column: 1 / -1; } }
section { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); padding: 20px; box-shadow: var(--shadow); min-width: 0; }
h2 { font-size: 18px; margin: 0 0 4px; }
.hint { color: var(--muted); font-size: 14px; margin: 0 0 14px; }
textarea, input, select {
  width: 100%; font: inherit; color: inherit; background: var(--bg); border: 1px solid var(--line);
  border-radius: 10px; padding: 10px 12px;
}
textarea { min-height: 92px; resize: vertical; }
textarea:focus, input:focus, select:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0 0; }
.chip { font: inherit; font-size: 13px; border: 1px solid var(--line); background: transparent; color: var(--muted); border-radius: 999px; padding: 3px 10px; cursor: pointer; }
.chip:hover { color: var(--text); border-color: var(--muted); }
.fields { display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; margin: 16px 0 0; font-size: 15px; }
.fields dt { color: var(--muted); }
.fields dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
.fields .empty { color: var(--line); }
.meter { display: flex; align-items: center; gap: 10px; margin-top: 16px; font-size: 14px; color: var(--muted); }
.bar { flex: 1; height: 8px; background: var(--line); border-radius: 99px; overflow: hidden; }
.bar span { display: block; height: 100%; background: var(--accent); width: 0; transition: width .25s; }
.warnings { list-style: none; padding: 0; margin: 12px 0 0; display: grid; gap: 6px; }
.warnings li { background: var(--warn-soft); color: var(--warn); border-radius: 8px; padding: 6px 10px; font-size: 14px; }
.formatted { margin-top: 14px; padding: 12px; border-radius: 10px; background: var(--accent-soft); font-size: 15px; }
.formatted div + div { color: var(--muted); margin-top: 4px; }
.combo { position: relative; }
.listbox { list-style: none; margin: 6px 0 0; padding: 4px; border: 1px solid var(--line); border-radius: 10px; background: var(--card); max-height: 320px; overflow: auto; }
.listbox[hidden] { display: none; }
.listbox li { padding: 8px 10px; border-radius: 8px; cursor: pointer; display: flex; gap: 10px; align-items: baseline; }
.listbox li[aria-selected="true"], .listbox li:hover { background: var(--accent-soft); }
.badge { font-size: 12px; color: var(--muted); border: 1px solid var(--line); border-radius: 6px; padding: 0 6px; white-space: nowrap; }
.listbox small { color: var(--muted); display: block; }
.picked { margin-top: 12px; font-size: 15px; color: var(--muted); }
.selects { display: grid; gap: 10px; grid-template-columns: 1fr; }
@media (min-width: 640px) { .selects { grid-template-columns: repeat(4, 1fr); } }
label { font-size: 14px; color: var(--muted); display: grid; gap: 4px; }
footer { margin-top: 28px; color: var(--muted); font-size: 14px; }
`

const FETCH_API = `
const getData = (url, init) => fetch(url, init).then((r) => r.json()).then((r) => r.data);
const api = {
  parse: (text) => getData('/v1/parse', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) }),
  search: (q) => getData('/v1/search?limit=8&q=' + encodeURIComponent(q)),
  provinces: () => getData('/v1/provinces'),
  districts: (id) => getData('/v1/provinces/' + id + '/districts'),
  subDistricts: (id) => getData('/v1/districts/' + id + '/sub-districts'),
  reverse: (lat, lng) => getData('/v1/reverse?lat=' + lat + '&lng=' + lng),
};
`

const SCRIPT = `
const $ = (s) => document.querySelector(s);
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const TYPE = { province: 'จังหวัด', district: 'อำเภอ/เขต', subDistrict: 'ตำบล/แขวง' };

const EXAMPLES = [
  ['มีคำนำหน้า', '99/1 ม.4 ต.บางพลีใหญ่ อ.บางพลี จ.สมุทรปราการ 10540'],
  ['ไม่เว้นวรรค', '99/1ม.4ต.บางพลีใหญ่อ.บางพลีจ.สมุทรปราการ10540'],
  ['พิมพ์ผิด', 'บางพลีใหน่ บางพลี สมุทรปราการ 10540'],
  ['จากแชต', 'คุณสมชาย ใจดี 55/3 ซ.สุขุมวิท 101/1 แขวงบางจาก เขตพระโขนง กทม 10260 โทร 081-234-5678'],
  ['English', '99/1 Moo 4, Bang Phli Yai, Bang Phli, Samut Prakan 10540'],
  ['รหัสผิด', 'ต.ในเมือง อ.เมือง จ.ขอนแก่น 40001'],
];
const FIELDS = [
  ['houseNo', 'บ้านเลขที่'], ['moo', 'หมู่'], ['village', 'หมู่บ้าน'], ['soi', 'ซอย'], ['road', 'ถนน'],
  ['subDistrict', 'ตำบล / แขวง'], ['district', 'อำเภอ / เขต'], ['province', 'จังหวัด'],
  ['postcode', 'รหัสไปรษณีย์'], ['phone', 'โทรศัพท์'], ['rest', 'ข้อความอื่น'],
];

const addr = $('#addr');
const chips = $('#examples');
EXAMPLES.forEach(([label, text]) => {
  const b = el('button', 'chip', label);
  b.type = 'button';
  b.addEventListener('click', () => { addr.value = text; parse(); });
  chips.append(b);
});

async function parse() {
  const text = addr.value.trim();
  const d = text ? await api.parse(text) : null;
  if ((text && !d) || addr.value.trim() !== text) return;
  const dl = $('#fields');
  dl.replaceChildren();
  FIELDS.forEach(([key, label]) => {
    const v = d && d[key];
    const value = v && typeof v === 'object' ? v.nameTh + ' · ' + v.nameEn : v;
    dl.append(el('dt', '', label), el('dd', value ? '' : 'empty', value || '—'));
  });
  const pct = d ? Math.round(d.confidence * 100) : 0;
  const bar = $('#bar');
  bar.style.width = pct + '%';
  bar.style.background = pct >= 85 ? 'var(--accent)' : pct >= 60 ? 'var(--warn)' : 'var(--bad)';
  $('#confidence').textContent = d ? 'ความมั่นใจ ' + pct + '%' : '';
  $('#warnings').replaceChildren(...(d ? d.warnings : []).map((w) => el('li', '', w.code + ': ' + w.message)));
  const f = $('#formatted');
  f.hidden = !(d && d.formatted);
  if (d && d.formatted) f.replaceChildren(el('div', '', d.formatted.th), el('div', '', d.formatted.en));
}
addr.addEventListener('input', debounce(parse, 300));

const input = $('#q');
const listbox = $('#results');
let items = [];
let active = -1;
function closeList() { listbox.hidden = true; input.setAttribute('aria-expanded', 'false'); active = -1; }
function highlight(i) {
  active = i;
  [...listbox.children].forEach((li, n) => li.setAttribute('aria-selected', String(n === i)));
  if (i >= 0) { input.setAttribute('aria-activedescendant', 'opt-' + i); listbox.children[i].scrollIntoView({ block: 'nearest' }); }
}
function renderList() {
  listbox.replaceChildren(...items.map((item, i) => {
    const li = el('li');
    li.id = 'opt-' + i;
    li.setAttribute('role', 'option');
    const text = el('div', '', item.labelTh);
    text.append(el('small', '', item.labelEn));
    li.append(el('span', 'badge', TYPE[item.type]), text);
    li.addEventListener('mousedown', (e) => { e.preventDefault(); choose(item); });
    return li;
  }));
  listbox.hidden = items.length === 0;
  input.setAttribute('aria-expanded', String(items.length > 0));
  highlight(items.length ? 0 : -1);
}
input.addEventListener('input', debounce(async () => {
  const q = input.value.trim();
  if (!q) { items = []; return closeList(); }
  const found = await api.search(q);
  if (input.value.trim() !== q) return;
  items = found || [];
  renderList();
}, 120));
input.addEventListener('keydown', (e) => {
  if (listbox.hidden) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); highlight(Math.min(active + 1, items.length - 1)); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); highlight(Math.max(active - 1, 0)); }
  else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); choose(items[active]); }
  else if (e.key === 'Escape') closeList();
});
input.addEventListener('blur', () => setTimeout(closeList, 100));

async function choose(item) {
  input.value = item.labelTh;
  closeList();
  $('#picked').textContent = item.labelEn + (item.subDistrict ? ' · รหัส ' + item.subDistrict.id : '');
  await setSelects(item.province.id, item.district && item.district.id, item.subDistrict && item.subDistrict.id);
}

const prov = $('#province');
const dist = $('#district');
const sub = $('#sub');
const zip = $('#zip');
function fill(select, list, placeholder) {
  select.replaceChildren(el('option', '', placeholder), ...list.map((x) => { const o = el('option', '', x.nameTh); o.value = x.id; return o; }));
  select.options[0].value = '';
  select.disabled = list.length === 0;
}
async function loadDistricts(id) {
  fill(dist, id ? await api.districts(id) : [], 'อำเภอ / เขต');
  fill(sub, [], 'ตำบล / แขวง');
  zip.value = '';
}
let subs = [];
async function loadSubs(id) {
  subs = id ? await api.subDistricts(id) : [];
  fill(sub, subs, 'ตำบล / แขวง');
  zip.value = '';
}
prov.addEventListener('change', () => loadDistricts(prov.value));
dist.addEventListener('change', () => loadSubs(dist.value));
sub.addEventListener('change', () => { const s = subs.find((x) => String(x.id) === sub.value); zip.value = s ? s.postcode : ''; });
async function setSelects(p, d, s) {
  prov.value = String(p);
  await loadDistricts(p);
  if (!d) return;
  dist.value = String(d);
  await loadSubs(d);
  if (!s) return;
  sub.value = String(s);
  sub.dispatchEvent(new Event('change'));
}
const located = $('#located');
$('#locate').addEventListener('click', () => {
  if (!navigator.geolocation) { located.textContent = 'เบราว์เซอร์นี้ระบุตำแหน่งไม่ได้'; return; }
  located.textContent = 'กำลังหาตำแหน่ง...';
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const [hit] = (await api.reverse(pos.coords.latitude, pos.coords.longitude)) || [];
    if (!hit) { located.textContent = 'ไม่พบตำบลในระยะ 30 กม.'; return; }
    located.textContent = 'ใกล้จุดกลางตำบล' + hit.subDistrict.nameTh + ' ' + hit.distanceKm + ' กม.';
    await setSelects(hit.province.id, hit.district.id, hit.subDistrict.id);
  }, () => { located.textContent = 'ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง'; }, { timeout: 10000 });
});

const params = new URLSearchParams(location.search);
if (params.has('text')) addr.value = params.get('text');
Promise.resolve(api.provinces()).then((list) => fill(prov, list, 'จังหวัด'));
parse();
if (params.get('q')) { input.value = params.get('q'); input.dispatchEvent(new Event('input')); }
`

export interface HomePageOptions {
  /** Static build: the library is bundled into demo.js and nothing is fetched from an API. */
  standalone?: boolean
}

export function homePage({ standalone = false }: HomePageOptions = {}): string {
  const nav = standalone
    ? '<a href="https://github.com/nuttakulsv/thai-address-api">GitHub</a><a href="https://www.npmjs.com/package/thai-address-api">npm</a><a href="https://github.com/nuttakulsv/thai-address-api#http-api">HTTP API</a>'
    : '<a href="/docs">API reference</a><a href="/openapi.json">openapi.json</a><a href="https://github.com/nuttakulsv/thai-address-api">GitHub</a>'
  const scripts = standalone
    ? `<script src="demo.js"></script>\n<script>const api = window.thaiAddress;${SCRIPT}</script>`
    : `<script>${FETCH_API}${SCRIPT}</script>`
  return `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Thai Address API</title>
<meta name="description" content="ค้นหา แยก และจัดรูปแบบที่อยู่ไทย ทั้ง 77 จังหวัด 928 อำเภอ 7,436 ตำบล">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;600&display=swap" rel="stylesheet">
<style>${STYLE}</style>
</head>
<body>
<main>
  <header>
    <h1>Thai Address API</h1>
    <p>ค้นหา แยก และจัดรูปแบบที่อยู่ไทย ครบ 77 จังหวัด 928 อำเภอ 7,436 ตำบล ใช้งานได้ทั้งภาษาไทยและอังกฤษ</p>
    <nav>${nav}</nav>${standalone ? '\n    <p class="note">หน้านี้ทำงานในเบราว์เซอร์ทั้งหมด ที่อยู่ที่พิมพ์ไม่ถูกส่งไปเซิร์ฟเวอร์ไหน</p>' : ''}
  </header>
  <div class="grid">
    <section>
      <h2>วางที่อยู่</h2>
      <p class="hint">วางที่อยู่แบบไหนก็ได้ ระบบจะแยกเป็นช่องและตรวจกับฐานข้อมูลตำบลให้</p>
      <label for="addr">ที่อยู่</label>
      <textarea id="addr" spellcheck="false">คุณสมชาย ใจดี 55/3 ซ.สุขุมวิท 101/1 แขวงบางจาก เขตพระโขนง กทม 10260 โทร 081-234-5678</textarea>
      <div class="chips" id="examples" aria-label="ตัวอย่าง"></div>
      <div class="meter"><div class="bar"><span id="bar"></span></div><span id="confidence"></span></div>
      <ul class="warnings" id="warnings"></ul>
      <dl class="fields" id="fields"></dl>
      <div class="formatted" id="formatted" hidden></div>
    </section>
    <section>
      <h2>ค้นหาแบบพิมพ์</h2>
      <p class="hint">พิมพ์ชื่อตำบล อำเภอ จังหวัด หรือรหัสไปรษณีย์ พิมพ์ผิดนิดหน่อยก็ยังเจอ</p>
      <div class="combo">
        <label for="q">ค้นหา</label>
        <input id="q" type="search" autocomplete="off" placeholder="เช่น บางพลีใหน่, ลุมพินี, หนองบัว ขอนแก่น, 10540" role="combobox" aria-controls="results" aria-expanded="false" aria-autocomplete="list">
        <ul class="listbox" id="results" role="listbox" hidden></ul>
      </div>
      <p class="picked" id="picked"></p>
    </section>
    <section class="wide">
      <h2>Dropdown แบบเลือกทีละขั้น</h2>
      <p class="hint">เลือกจังหวัด แล้วอำเภอและตำบลจะโหลดตามมา รหัสไปรษณีย์ขึ้นให้เอง หรือให้หาจากตำแหน่งปัจจุบันก็ได้</p>
      <div class="selects">
        <label>จังหวัด<select id="province"></select></label>
        <label>อำเภอ / เขต<select id="district" disabled></select></label>
        <label>ตำบล / แขวง<select id="sub" disabled></select></label>
        <label>รหัสไปรษณีย์<input id="zip" readonly></label>
      </div>
      <p class="picked"><button type="button" class="chip" id="locate">ใช้ตำแหน่งของฉัน</button> <span id="located"></span></p>
    </section>
  </div>
  <footer>
    ข้อมูลจังหวัด อำเภอ ตำบล จาก <a href="https://github.com/kongvut/thai-province-data">kongvut/thai-province-data</a> (MIT)
    พิกัดจาก <a href="https://data.humdata.org/dataset/cod-ab-tha">OCHA COD-AB</a> (CC BY-IGO)
  </footer>
</main>
${scripts}
</body>
</html>`
}

export function docsPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Thai Address API reference</title>
</head>
<body>
<div id="app"></div>
<script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.72.3/dist/browser/standalone.js" integrity="sha384-HWi/QCSPi64AQ0xBXFGDk+7gmvZ4hJ/7sZMIXqWVz6Ikb6+Cxej/hWKaomOStyFb" crossorigin="anonymous"></script>
<script>Scalar.createApiReference('#app', { url: '/openapi.json' })</script>
</body>
</html>`
}
