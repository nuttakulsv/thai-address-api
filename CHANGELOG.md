# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-10-02

First release.

### Added

- Embedded dataset: 77 provinces, 928 districts, 7,436 sub-districts and 966 postcodes from kongvut/thai-province-data (`7d689e4`), with sub-district centre points from OCHA COD-AB.
- `parseAddress()` for free-text Thai and English addresses, with confidence, warnings and ranked candidates.
- `search()` autocomplete with typo tolerance, English names, province nicknames and postcode prefixes.
- `lookupPostcode()`, `reverseGeocode()`, `formatAddress()` and list/get helpers for cascading dropdowns.
- HTTP API on Hono with OpenAPI 3.1, a demo page and an API reference page.
- Static browser demo for GitHub Pages (`npm run demo:build`) that runs the library in the page, plus a "use my location" button on the demo page.
- `thai-address-api` CLI with `serve`, `parse`, `search` and `postcode` commands.
- Dockerfile and Cloudflare Workers entry.

[0.1.0]: https://github.com/nuttakulsv/thai-address-api/releases/tag/v0.1.0
