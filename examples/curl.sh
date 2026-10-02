#!/usr/bin/env sh
# Start the server first: npx thai-address-api
BASE=${BASE:-http://localhost:3000}
set -x

curl -s "$BASE/v1/provinces/11/districts"
curl -s "$BASE/v1/districts/1103/sub-districts"
curl -s "$BASE/v1/postcodes/10540"
curl -s -G "$BASE/v1/search" --data-urlencode "q=บางพลีใหน่" --data-urlencode "limit=3"
curl -s -X POST "$BASE/v1/parse" -H 'content-type: application/json' \
  -d '{"text":"99/1ม.4ต.บางพลีใหญ่อ.บางพลีจ.สมุทรปราการ10540"}'
curl -s "$BASE/v1/reverse?lat=13.7466&lng=100.5393&limit=3"
