# Data

The dataset in `src/data/data.ts` is built from two sources:

- Names, codes and postcodes: [kongvut/thai-province-data](https://github.com/kongvut/thai-province-data), MIT License.
- Coordinates: centre points of the sub-district polygons in [Thailand - Subnational Administrative Boundaries](https://data.humdata.org/dataset/cod-ab-tha) (COD-AB, Royal Thai Survey Department via OCHA), CC BY-IGO 3.0. Extracted once into `data/centroids.csv`.

| | |
|---|---|
| Source commit | [`7d689e4`](https://github.com/kongvut/thai-province-data/tree/7d689e478a577a1c9348f2b998c39dd4c2bf153d) |
| Commit date | 2026-09-29 |
| Regions | 6 |
| Provinces | 77 |
| Districts | 928 (878 อำเภอ + 50 เขต) |
| Sub-districts | 7436 (7256 ตำบล + 180 แขวง) |
| Postcodes | 966 |
| Sub-districts with coordinates | 7422 |
| Sub-districts without coordinates | 14 |
| Embedded size | 567 KB raw, 179 KB gzipped |

## Changes made during the build

- Province ids are the official two-digit DOPA codes (for example `10` Bangkok, `11` Samut Prakan) instead of the source's running numbers. District and sub-district ids are unchanged, they are already DOPA codes.
- Prefixes (เขต/อำเภอ, แขวง/ตำบล) are not stored. They depend only on whether the area is in Bangkok, and the build checks that this holds for every row.
- Rows are sorted by Thai collation, so lists come out in the order people expect in a dropdown.
- Coordinates are rounded to 5 decimal places. The upstream dataset has points too, but none for Bangkok and some that sit tens of kilometres from the area they belong to, so they are not used.
- These sub-districts have no coordinates because they were created after the boundary dataset was published: 105005 คลองบางบอน, 105004 คลองบางพราน, 104403 ทับช้าง, 530407 ท่าแฝก, 104703 บางนาใต้, 104702 บางนาเหนือ, 105003 บางบอนใต้, 105002 บางบอนเหนือ, 101406 พญาไท, 100910 พระโขนงใต้, 103403 พัฒนาการ, 102602 รัชดาภิเษก, 104402 ราษฎร์พัฒนา, 103402 อ่อนนุช.
- Dropped district 7074 "ท้องถิ่นเทศบาลตำบลบ้านฆ้อง" because it has no sub-districts
- Dropped district 9077 "ท้องถิ่นเทศบาลตำบลสำนักขาม" because it has no sub-districts
- Removed a stray "*" from the English name of sub-district 841505 (*Khao Niphan)
- Removed a stray "*" from the English name of sub-district 470704 (*Suwannakarm)

## Refreshing the coordinates

`data/centroids.csv` holds `adm3_pcode`, `center_lat` and `center_lon` from the `tha_admin3` sheet of `tha_admin_boundaries.xlsx` on [HDX](https://data.humdata.org/dataset/cod-ab-tha), with the `TH` prefix removed. To refresh it:

```bash
pip install openpyxl
python3 - <<'PY'
import openpyxl
ws = openpyxl.load_workbook('tha_admin_boundaries.xlsx', read_only=True)['tha_admin3']
rows = ws.iter_rows(values_only=True)
col = {name: i for i, name in enumerate(next(rows))}
lines = sorted('%d,%.5f,%.5f' % (int(r[col['adm3_pcode']][2:]), r[col['center_lat']], r[col['center_lon']]) for r in rows)
open('data/centroids.csv', 'w').write('id,lat,lng\n' + '\n'.join(lines) + '\n')
PY
```

## Updating

```bash
npm run data:build             # rebuild from the pinned commit
npm run data:build -- --latest # rebuild from the newest commit on master
npm run data:build -- --sha <commit>
```

After updating, run `npm test`. The data tests check exact counts on purpose, so a change upstream shows up as a failing test you can review before release. Then update `PINNED_SHA` in `scripts/build-data.ts`.
