# 🕐 World Clock

A world clock with a 24-hour planner: the current time in your places on top,
and the next 24 hours side by side below, coloured by working hours, morning
and evening, and night. Made for office wall screens as much as for phones.

**▶ [clock.apphub.casa](https://clock.apphub.casa)**

## Features

- 🌍 **Your places** — search by city (`Mumbai`, `San Jose`, `Trondheim`), time
  zone (`America/Denver`) or offset (`UTC+5`). Rename, reorder, remove.
- 🗓️ **24-hour planner** — the current hour live, day changes marked, half-hour
  zones and daylight-saving changes handled. Click a row to copy its times
  (`15:00 Trondheim · 06:00 San Jose · 18:30 Bangalore`).
- 🎨 **Adjustable hours** — set working and awake hours for all places, or per
  place (night shifts across midnight work too).
- ⏰ **Daylight-saving heads-up** — places whose clocks change within a week say so.
- 📺 **Fills any screen** — from phones to 4K TVs, no scrolling on large
  screens. Fullscreen button (or `F`) that keeps the screen awake and hides
  the cursor; optional burn-in protection (gentle pixel shift or colour flash).
  Unattended screens pick up new versions by themselves overnight.
- 🔗 **Share setup** — one link sets up another screen or device the same way.
- ⚙️ Themes (auto, light, dark, hacker), 12/24-hour, optional seconds,
  English or Norwegian, show your own time zone, hide the big clocks.
- 📲 **Installable, works offline**, no accounts, no tracking, no third-party
  requests — settings live in the browser's `localStorage`.

For a screen that should start on its own, open the page in kiosk mode, e.g.
`chromium --kiosk https://clock.apphub.casa/#…` with a shared setup link.

## Development

Plain HTML, CSS and JavaScript — no build step, no dependencies:

```sh
python3 -m http.server
```

## Deploy

Cloudflare Pages project `world-clock` serves the repo root. A push to `main`
deploys to production; every other branch gets a preview at
`https://<branch>.world-clock-en0.pages.dev`.
