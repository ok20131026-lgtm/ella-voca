# Samsung / Android release

## Changes
- Compact word cards; 56px primary controls, 48px speaker/alphabet targets, separated rows.
- Dynamic viewport height with fallback; readable overflow instead of shrinking controls.
- Vibration toggle, drag suppression, rapid next/answer guard, Back/drawer history.
- Local study/test resume and JSON progress backup/restore. Existing score keys retained.
- Standalone PWA manifest, icons, versioned offline assets, optional update from Home.
- No external analytics, account requirement, or backend added.

## Verification
Run `npm test` and `npm run build`.
300 vocabulary entries / 20 lessons remain unchanged.
Regression covers 900 study renders and 1,824 original checks, plus Android state tests.
Offline worker tests cover install, activation, cached response and update opt-in.
Actual Samsung Chrome/Samsung Internet layout, audio, vibration and installation still
require device verification. No physical device or mobile visual pass is claimed.

## Deployment and maintenance
Push to the existing main branch to trigger the existing Vercel deployment.
Build output remains dist/. The build must include manifest, worker and icons.
Whenever cached source/data changes, bump VERSION in sw.js. Do not auto-activate an
update during a quiz. Users apply a waiting update from Home after studying.
Progress is browser-local; Chrome and Samsung Internet do not share localStorage.
Export a backup before changing browsers or clearing site data.

## Device checklist
- Chrome and Samsung Internet, normal tab and installed app.
- 360px width; short viewport; larger system text; light/dark mode.
- All four card controls remain separate and reachable by scrolling.
- Long definitions and hyphenated words do not overflow horizontally.
- Lock/unlock, reload/Resume, system Back and fast consecutive taps.
- Speaker does not flip/select the surrounding card; vibration toggle respected.
- First online load then offline restart; pronunciation depends on installed voices.
