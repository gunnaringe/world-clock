# 🕐 World Clock

A world clock with a 24-hour planner: the current time in your places on top,
and the next 24 hours side by side below, coloured by working hours, morning
and evening, and night. Made for office wall screens as much as for phones.

**▶ [clock.apphub.casa](https://clock.apphub.casa)**

## Features

- 🌍 **Your places** — search by city (`Mumbai`, `San Jose`, `Trondheim`), time
  zone (`America/Denver`) or offset (`UTC+5`). Rename, reorder, remove.
- 🗓️ **24-hour planner** — the current hour live, day changes marked, half-hour
  zones and daylight-saving changes handled. Click a row to select it, and another
  to select the hours between (or shift-click, drag with a mouse, or touch and
  hold, then drag). From the keyboard, an arrow key enters the table, Enter or
  Space selects, Shift+arrows select hours, and Esc clears, then leaves. Copy the times
  (`15:00–17:00 Trondheim · 06:00–08:00 San Jose · 19:30–21:30 Bangalore`)
  or share them as a link, picking which places to include: it shows the
  time in the recipient's places without changing their setup.
- 🎨 **Adjustable hours** — set working and awake hours for all places, or per
  place (night shifts across midnight work too).
- ⏰ **Daylight-saving heads-up** — places whose clocks change within a week say so.
- 📺 **Fills any screen** — from phones to 4K TVs, no scrolling on large
  screens. Fullscreen button (or `F`) that keeps the screen awake and hides
  the cursor; optional burn-in protection (a slow pixel drift, and dimming
  outside working hours).
  Unattended screens pick up new versions by themselves overnight.
- 🔗 **Share setup** — one link sets up another screen or device the same way.
- ⚙️ Themes (auto, light, dark, hacker), 12/24-hour, optional seconds,
  English or Norwegian, show your own time zone, hide the big clocks.
- 📲 **Installable, works offline**, no accounts, no tracking, no third-party
  requests — settings live in the browser's `localStorage`.

For a screen that should start on its own, open the page in kiosk mode, e.g.
`chromium --kiosk https://clock.apphub.casa/#…` with a shared setup link.
For screens without touch or a mouse (digital signage, e.g. a Webex device),
turn on **Signage mode** before copying the link: the buttons and pointer stay
hidden, and loading the same link again on every start shows no message.

## Development

Plain HTML, CSS and JavaScript — no build step, no dependencies:

```sh
python3 -m http.server
```

## Deploy

Cloudflare Pages project `world-clock` serves the repo root. A push to `main`
deploys to production; every other branch gets a preview at
`https://<branch>.world-clock-en0.pages.dev`.
