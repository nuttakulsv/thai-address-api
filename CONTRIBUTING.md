# Contributing

Thanks for taking the time. Bug reports with a real (but anonymised) address that parses wrongly are the most useful contribution, because they become test cases.

## Setup

```bash
git clone https://github.com/nuttakulsv/thai-address-api.git
cd thai-address-api
npm install
npm test
npm run dev      # API and demo page on http://localhost:3000, reloads on change
```

Node.js 22 or newer is needed for development.

## Before opening a pull request

```bash
npm run lint && npm run format:check && npm run typecheck && npm test
```

- Parser changes: add the input to `test/parse.test.ts`. Use made-up house numbers, names and phone numbers.
- Keep the core library free of runtime dependencies. Only `src/server` may import `hono`.
- `src/data/data.ts` is built by `npm run data:build`. Don't edit it by hand. See [data/README.md](data/README.md).

## Data corrections

Names, codes and postcodes come from [kongvut/thai-province-data](https://github.com/kongvut/thai-province-data). If an area is wrong or missing there, please report it upstream first so everyone using that dataset gets the fix. We pick it up with the next `npm run data:build`.

## ภาษาไทย

ยินดีรับทุก PR และ issue ถ้าเจอที่อยู่ที่แยกผิด ส่งมาเป็น issue ได้เลย (เปลี่ยนชื่อ เบอร์โทร และบ้านเลขที่ให้เป็นของสมมติก่อน) เราจะเพิ่มเป็น test case ให้ ส่วนข้อมูลตำบลที่ผิดหรือขาด แนะนำให้แจ้งที่ kongvut/thai-province-data ก่อน แล้วเราจะดึงข้อมูลใหม่มาในเวอร์ชันถัดไป
