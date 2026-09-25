# world-clock

World clock with a 24-hour planner at clock.apphub.casa. Main use: office wall
screens left running for weeks; phones and laptops second.

## Layout

No build, no dependencies, no third-party requests (system fonts), so it works
offline. Keep it that way.

- `index.html` + `script.js` — clocks and the 24-hour table.
- `settings.html` + `settings.js` — settings page.
- `common.js` — time zone math, search, settings storage, share links. Shared.
- `i18n.js` — all UI strings (`en`, `no`; same keys in both) and `t()` /
  `applyI18n()`, wired via `data-i18n`, `-html`, `-title`, `-aria`, `-placeholder`.
- `theme.js` — loaded in `<head>` so the theme applies before first paint.
- `styles.css` — one stylesheet; themes are `[data-theme]` blocks of CSS
  variables. The fill-the-screen layout is the `min-width: 900px and
  min-height: 560px` media block; `fitTable()` shrinks table text if 24 rows
  still don't fit.
- `sw.js`, `manifest.webmanifest`, `icons/` — offline/PWA.

## Deploy

Cloudflare **Pages** project `world-clock` (not a Worker), output dir = repo
root. Push to `main` deploys production (clock.apphub.casa, clock.haxxor.xyz);
every branch gets `https://<branch>.world-clock-en0.pages.dev`. Iterate on a
branch and check the preview before touching `main`. Agent sessions can read
Pages deployments via the Cloudflare API but can't change anything.

Pages serves pretty URLs: `/settings.html` 308-redirects to `/settings`,
`/index.html` to `/`. Use `curl -L` when checking a preview, and remember it
when touching the service worker.

## Settings (`localStorage`)

Plain keys, compatible with the first version: `locations`
(`[{ id, name, timeZone, hours? }]`), `hourFormat` (`"24"`/`"12"`),
`showLocal`, `showClocks`, `seconds` (JSON bools, defaults in `TOGGLES`),
`protection` (`none`/`gentle`/`flash`; the old `screenFlash: true` reads as
`flash`), `theme` (`auto`/`light`/`dark`/`hacker`), `lang` (`auto`/`en`/`no`),
`hours` (`DEFAULT_HOURS` shape). Every key must be listed in `SETTINGS_KEYS`
(reset, share-link import and undo rely on it). Render user text with
`textContent` — names can come from share links.

Hours: whole hours 0–23, ranges `[start, end)` that may wrap midnight; work wins
over awake, outside awake is night. Defaults 08–17 / 07–23 reproduce the
original colouring exactly.

## Share links

`encodeSetup()` / `decodeSetup()` in `common.js`; the format is documented
above them. Links are a **public contract**: only add keys, never change the
meaning of existing ones. The clock page applies a link once (`takeHash`),
strips the fragment and offers undo.

## Time zones

- Compare zones via `canon()` — Chrome reports legacy IDs (`Asia/Calcutta` for
  `Asia/Kolkata`).
- Offsets come from `longOffset` so half-hour zones work; day labels compare
  calendar dates, not offsets.
- `Etc/GMT-5` is UTC**+5** (POSIX sign flip).
- Table rows are real instants (`start + i h`), so DST changes and dates come
  out right; don't go back to `setHours`.
- Extra searchable cities go in `ALIASES`.

## Service worker

Network-first for everything (the app is several files; cache-first would mix
new HTML with old JS). Cache keys are normalised to the pretty URLs; redirected
responses are never served to navigations. Bump `CACHE` only when changing the
precache list or strategy. Wall screens also reload around 04:00 if the app
files changed (`checkForUpdate` in `script.js`) — add new app files to both
`PRECACHE` and `APP_FILES`.

## Testing

Serve the repo root over http (`python3 -m http.server`) and drive it with
Playwright: set `timezoneId` (e.g. `Europe/Oslo`) on the context, use
`page.clock.install()` for fixed dates (DST: late March/October in Europe,
late September/early April in Auckland), and block service workers locally
(`serviceWorkers: 'block'`) unless testing them. Check viewports from 320 px
phones to 3840×2160 — on screens ≥ 900×560 the page must not scroll. Offline
behaviour is best tested on the Pages preview, where the redirects exist.
Stop the local server with `fuser -k 8765/tcp`.
