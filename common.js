// Shared by index.html and settings.html: storage, time zone math, search.

// ---------- Time zones ----------

// Canonical ID as this browser spells it (Chrome says Asia/Calcutta for
// Asia/Kolkata), or null if the zone isn't supported. Compare zones with this.
const canonCache = new Map();
function canon(zone) {
    if (!zone) return null;
    if (!canonCache.has(zone)) {
        let id = null;
        try { id = new Intl.DateTimeFormat('en-US', { timeZone: zone }).resolvedOptions().timeZone; } catch {}
        canonCache.set(zone, id);
    }
    return canonCache.get(zone);
}

const LOCAL = canon(Intl.DateTimeFormat().resolvedOptions().timeZone) || 'UTC';

// Cities people look for that aren't a time zone ID themselves.
const ALIASES = [
    ['San Jose', 'America/Los_Angeles'], ['San Francisco', 'America/Los_Angeles'],
    ['Seattle', 'America/Los_Angeles'], ['Portland', 'America/Los_Angeles'],
    ['Las Vegas', 'America/Los_Angeles'], ['San Diego', 'America/Los_Angeles'],
    ['Salt Lake City', 'America/Denver'], ['Dallas', 'America/Chicago'],
    ['Houston', 'America/Chicago'], ['Austin', 'America/Chicago'],
    ['Minneapolis', 'America/Chicago'], ['Washington', 'America/New_York'],
    ['Boston', 'America/New_York'], ['Atlanta', 'America/New_York'],
    ['Miami', 'America/New_York'], ['Philadelphia', 'America/New_York'],
    ['Montreal', 'America/Toronto'], ['Ottawa', 'America/Toronto'],
    ['Calgary', 'America/Edmonton'], ['Rio de Janeiro', 'America/Sao_Paulo'],
    ['Reykjavik', 'Atlantic/Reykjavik'], ['Edinburgh', 'Europe/London'],
    ['Manchester', 'Europe/London'], ['Bergen', 'Europe/Oslo'],
    ['Trondheim', 'Europe/Oslo'], ['Stavanger', 'Europe/Oslo'],
    ['Tromsø', 'Europe/Oslo'], ['Kristiansand', 'Europe/Oslo'],
    ['Gothenburg', 'Europe/Stockholm'], ['Göteborg', 'Europe/Stockholm'],
    ['Malmö', 'Europe/Stockholm'], ['Aarhus', 'Europe/Copenhagen'],
    ['Munich', 'Europe/Berlin'], ['Frankfurt', 'Europe/Berlin'],
    ['Hamburg', 'Europe/Berlin'], ['Barcelona', 'Europe/Madrid'],
    ['Milan', 'Europe/Rome'], ['Geneva', 'Europe/Zurich'],
    ['Krakow', 'Europe/Warsaw'], ['Kyiv', 'Europe/Kyiv'],
    ['Saint Petersburg', 'Europe/Moscow'], ['Tel Aviv', 'Asia/Jerusalem'],
    ['Abu Dhabi', 'Asia/Dubai'], ['Mumbai', 'Asia/Kolkata'],
    ['Delhi', 'Asia/Kolkata'], ['New Delhi', 'Asia/Kolkata'],
    ['Bangalore', 'Asia/Kolkata'], ['Bengaluru', 'Asia/Kolkata'],
    ['Kolkata', 'Asia/Kolkata'], ['Chennai', 'Asia/Kolkata'],
    ['Hyderabad', 'Asia/Kolkata'], ['Ho Chi Minh City', 'Asia/Ho_Chi_Minh'],
    ['Hanoi', 'Asia/Bangkok'], ['Beijing', 'Asia/Shanghai'],
    ['Shenzhen', 'Asia/Shanghai'], ['Osaka', 'Asia/Tokyo'],
    ['Kyoto', 'Asia/Tokyo'], ['Busan', 'Asia/Seoul'],
    ['Canberra', 'Australia/Sydney'], ['Wellington', 'Pacific/Auckland'],
    ['Cape Town', 'Africa/Johannesburg'], ['Kathmandu', 'Asia/Kathmandu'],
];

// Browsers still report some zones by old IDs (Chrome: Asia/Calcutta); show
// today's city names for those.
const RENAMED = {
    'Asia/Calcutta': 'Kolkata', 'Asia/Saigon': 'Ho Chi Minh City', 'Asia/Katmandu': 'Kathmandu',
    'Asia/Rangoon': 'Yangon', 'Europe/Kiev': 'Kyiv', 'Asia/Ulan_Bator': 'Ulaanbaatar',
    'America/Godthab': 'Nuuk', 'Atlantic/Faeroe': 'Faroe Islands', 'Asia/Dacca': 'Dhaka',
};

function cityOf(zone) {
    if (RENAMED[zone]) return RENAMED[zone];
    const fixed = /^Etc\/GMT([+-]\d+)$/.exec(zone);
    if (fixed) return offsetLabel(-60 * Number(fixed[1]));
    if (zone === 'UTC' || zone === 'Etc/UTC' || zone === 'Etc/GMT') return 'UTC';
    return zone.split('/').pop().replace(/_/g, ' ');
}

const fmtCache = new Map();
function fmt(key, make) {
    if (!fmtCache.has(key)) fmtCache.set(key, make());
    return fmtCache.get(key);
}

// Wall clock in a zone: { y, mo, d, h, mi, s, off } with off in minutes east of UTC.
function wall(zone, date) {
    const parts = fmt('wall|' + zone, () => new Intl.DateTimeFormat('en-US', {
        timeZone: zone, hourCycle: 'h23',
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric',
    })).formatToParts(date);
    const n = (type) => Number(parts.find((p) => p.type === type).value);
    const name = fmt('off|' + zone, () => new Intl.DateTimeFormat('en-US', {
        timeZone: zone, timeZoneName: 'longOffset',
    })).formatToParts(date).find((p) => p.type === 'timeZoneName').value;
    const m = /([+-])(\d{1,2}):?(\d{2})?/.exec(name); // "GMT+05:30", or "GMT" for UTC
    const off = m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] || 0)) : 0;
    return { y: n('year'), mo: n('month'), d: n('day'), h: n('hour') % 24, mi: n('minute'), s: n('second'), off };
}

const pad = (n) => String(n).padStart(2, '0');
const MINUS = '−';

function signed(min) {
    const a = Math.abs(min);
    return (min < 0 ? MINUS : '+') + Math.floor(a / 60) + (a % 60 ? ':' + pad(a % 60) : '');
}
function offsetLabel(min) { return min ? 'UTC' + signed(min) : 'UTC'; }

// "14:05" / "2:05 PM"; `short` drops ":00" in 12-hour mode ("2 PM").
function clockText(w, h12, short = false) {
    if (!h12) return pad(w.h) + ':' + pad(w.mi);
    const h = w.h % 12 || 12;
    const ap = w.h < 12 ? 'AM' : 'PM';
    return (short && !w.mi ? h : h + ':' + pad(w.mi)) + ' ' + ap;
}

// Hours used for colouring, as whole hours 0-23; ranges are [start, end) and
// may wrap past midnight. Work wins over awake; outside awake is night.
// The defaults give work 08-17, morning/evening 07-08 and 17-23, night 23-07.
const DEFAULT_HOURS = { workStart: 8, workEnd: 17, dayStart: 7, dayEnd: 23 };

function normHours(h) {
    if (!h || typeof h !== 'object') return null;
    const out = {};
    for (const k in DEFAULT_HOURS) {
        const v = Number(h[k]);
        out[k] = Number.isInteger(v) && v >= 0 && v <= 24 ? v % 24 : DEFAULT_HOURS[k];
    }
    return out;
}

function inRange(h, start, end) {
    return start <= end ? h >= start && h < end : h >= start || h < end;
}

// Day band for an hour: 'work', 'edge' (morning/evening) or 'night'.
function band(h, hours = DEFAULT_HOURS) {
    if (inRange(h, hours.workStart, hours.workEnd)) return 'work';
    if (inRange(h, hours.dayStart, hours.dayEnd)) return 'edge';
    return 'night';
}

// ---------- Search ----------

const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

let INDEX = null;
function buildIndex() {
    const zones = (Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : []).slice();
    if (!zones.includes('UTC')) zones.push('UTC');
    const seen = new Set();
    const out = [];
    const add = (label, zone) => {
        const id = canon(zone);
        if (!id) return;
        const key = fold(label) + '|' + id;
        if (seen.has(key)) return;
        seen.add(key);
        out.push({ label, zone, key: fold(label), id: fold(zone) });
    };
    for (const z of zones) add(cityOf(z), z);
    for (const [label, zone] of ALIASES) add(label, zone);
    return out;
}

// Matches city names, zone IDs ("america/den") and fixed offsets ("UTC+5").
function search(q) {
    q = fold(q.trim());
    if (!q) return [];
    // "UTC+5", "gmt-3", "+2": whole-hour fixed offsets (Etc/GMT-5 is UTC+5).
    const off = /^(?:utc|gmt)?\s*([+\-−])\s*(\d{1,2})$/.exec(q);
    if (off) {
        const hours = Number(off[2]) * (off[1] === '+' ? 1 : -1);
        if (hours >= -12 && hours <= 14) {
            const zone = hours === 0 ? 'UTC' : 'Etc/GMT' + (hours > 0 ? '-' : '+') + Math.abs(hours);
            if (canon(zone)) return [{ label: offsetLabel(hours * 60), zone }];
        }
    }
    INDEX ||= buildIndex();
    const scored = [];
    for (const e of INDEX) {
        let score;
        if (e.key.startsWith(q)) score = 0;
        else if (e.key.split(/[\s-]/).some((w) => w.startsWith(q))) score = 1;
        else if (e.key.includes(q)) score = 2;
        else if (q.length > 2 && e.id.includes(q.replace(/ /g, '_'))) score = 3;
        else continue;
        scored.push([score, e]);
    }
    scored.sort((a, b) => a[0] - b[0] || a[1].label.localeCompare(b[1].label));
    return scored.slice(0, 8).map(([, e]) => e);
}

// ---------- Settings ----------
// Same keys and shapes as the first version so saved settings carry over:
// locations: [{ id, name, timeZone }], hourFormat: "24" | "12", screenFlash: bool.
// Added since: showLocal, showClocks, seconds (bools, see TOGGLES), theme
// (theme.js), lang (i18n.js), protection (PROTECTIONS; replaces screenFlash),
// hours (DEFAULT_HOURS shape) and per-location `hours` overriding it.

// First visit: your own city, then New York, Berlin and Kolkata (skipping
// any that share your time zone).
function defaultLocations() {
    const list = [{ name: cityOf(LOCAL), timeZone: LOCAL }];
    for (const [name, timeZone] of [['New York', 'America/New_York'], ['Berlin', 'Europe/Berlin'], ['Kolkata', 'Asia/Kolkata']]) {
        if (canon(timeZone) && !list.some((l) => canon(l.timeZone) === canon(timeZone))) list.push({ name, timeZone });
    }
    return list;
}

function readJSON(key, fallback) {
    try {
        const v = JSON.parse(localStorage.getItem(key));
        return v ?? fallback;
    } catch {
        return fallback;
    }
}

function getLocations() {
    const list = readJSON('locations', null);
    return (Array.isArray(list) ? list : defaultLocations())
        .filter((l) => l && canon(l.timeZone))
        .map((l) => ({
            name: String(l.name || '').trim() || cityOf(l.timeZone),
            timeZone: l.timeZone,
            hours: normHours(l.hours),
        }));
}

function setLocations(list) {
    localStorage.setItem('locations', JSON.stringify(
        list.map((l, i) => ({ id: 'clock-' + i, name: l.name, timeZone: l.timeZone, ...(l.hours && { hours: l.hours }) }))));
}

function getHours() { return normHours(readJSON('hours', null)) || { ...DEFAULT_HOURS }; }
function setHours(h) { localStorage.setItem('hours', JSON.stringify(h)); }

function getHourFormat() { return localStorage.getItem('hourFormat') === '12' ? '12' : '24'; }
function setHourFormat(f) { localStorage.setItem('hourFormat', f); }

// On/off settings and their defaults.
const TOGGLES = { showLocal: true, showClocks: true, seconds: false };
function getToggle(key) {
    const v = readJSON(key, TOGGLES[key]);
    return typeof v === 'boolean' ? v : TOGGLES[key];
}
function setToggle(key, on) { localStorage.setItem(key, JSON.stringify(on)); }

// Burn-in protection. The first version only had screenFlash (on/off).
const PROTECTIONS = ['none', 'gentle', 'flash'];
function getProtection() {
    const v = localStorage.getItem('protection');
    if (PROTECTIONS.includes(v)) return v;
    return readJSON('screenFlash', false) === true ? 'flash' : 'none';
}
function setProtection(v) {
    localStorage.setItem('protection', v);
    localStorage.removeItem('screenFlash');
}

const THEMES = ['auto', 'light', 'dark', 'hacker'];
function getTheme() { const v = localStorage.getItem('theme'); return THEMES.includes(v) ? v : 'auto'; }

const SETTINGS_KEYS = ['locations', 'hourFormat', 'screenFlash', 'protection', 'showLocal', 'showClocks',
    'seconds', 'theme', 'lang', 'hours'];
function resetSettings() { for (const k of SETTINGS_KEYS) localStorage.removeItem(k); }

// ---------- Share links ----------
//
// "Share setup" puts the settings in the URL fragment of the clock page.
// Opening such a link applies it once: it's saved to localStorage, stripped
// from the address bar and an undo toast is shown. The link describes the
// whole setup; anything left out gets its default. Links are a public
// contract: only add keys, never change the meaning of existing ones.
// Format: `&`-separated `key=value`:
//
//   p=Europe/Oslo_Trondheim~America/Los+Angeles_San+Jose__9-17-7-23
//        places, `~`-separated, in order. Each is `zone[_name[_hours]]`:
//        zone is the time zone ID with `_` written as `+` (IDs have no
//        spaces; a real `+`, as in Etc/GMT+5, is `%2B`); name is left empty
//        when it's the zone's own city name; hours as for h=. Always written,
//        `p=` alone means no places.
//   h=8-17-7-23   hours: work start-end, awake start-end (whole hours)
//   f=12          12-hour clock
//   o=cs          on/off settings that are on: l = show your time zone,
//                 c = show clocks, s = seconds. Written only if they differ
//                 from the defaults (l and c on).
//   t=hacker      theme: light, dark or hacker (auto if left out)
//   b=gentle      screen protection: gentle or flash (none if left out)
//   l=no          language, always written: "auto" is resolved to what the
//                 sender sees, so the setup looks the same everywhere.
//
// Links use only letters, digits and `-_~+%&=/` (and `.` inside zones):
// chat apps decide where a pasted link ends and many stop at `,` or `:` or
// trim trailing `.!)'`, so names escape those. Unknown keys, unknown zones and
// malformed parts are ignored.

const OPT_LETTERS = { l: 'showLocal', c: 'showClocks', s: 'seconds' };

const encName = (n) => encodeURIComponent(n)
    .replace(/[!'()*._~]/g, (ch) => '%' + ch.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%20/g, '+');
const decName = (n) => {
    try { return decodeURIComponent(n.replace(/\+/g, ' ')); } catch { return ''; }
};
const encZone = (z) => z.replace(/\+/g, '%2B').replace(/_/g, '+');
const decZone = (z) => {
    try { return decodeURIComponent(z.replace(/\+/g, '_')); } catch { return ''; }
};
const encHours = (h) => [h.workStart, h.workEnd, h.dayStart, h.dayEnd].join('-');
const decHours = (v) => {
    const n = v.split('-');
    if (n.length !== 4) return null;
    return normHours({ workStart: n[0], workEnd: n[1], dayStart: n[2], dayEnd: n[3] });
};
const sameHours = (a, b) => encHours(a) === encHours(b);

function encodeSetup() {
    const parts = [];
    parts.push('p=' + getLocations().map((l) => {
        let tok = encZone(l.timeZone);
        const name = l.name === cityOf(l.timeZone) ? '' : encName(l.name);
        if (name || l.hours) tok += '_' + name;
        if (l.hours) tok += '_' + encHours(l.hours);
        return tok;
    }).join('~'));
    const hours = getHours();
    if (!sameHours(hours, DEFAULT_HOURS)) parts.push('h=' + encHours(hours));
    if (getHourFormat() === '12') parts.push('f=12');
    const opts = Object.keys(OPT_LETTERS).filter((c) => getToggle(OPT_LETTERS[c])).join('');
    const defaults = Object.keys(OPT_LETTERS).filter((c) => TOGGLES[OPT_LETTERS[c]]).join('');
    if (opts !== defaults) parts.push('o=' + opts);
    if (getTheme() !== 'auto') parts.push('t=' + getTheme());
    if (getProtection() !== 'none') parts.push('b=' + getProtection());
    parts.push('l=' + currentLang());
    return parts.join('&');
}

function shareUrl() {
    return new URL('./', location.href).href + '#' + encodeSetup();
}

// Settings from a link as { key: raw localStorage value, or null to remove }.
function decodeSetup(hash) {
    const out = {};
    for (const k of SETTINGS_KEYS) out[k] = null;
    let isSetup = false;
    for (const part of hash.split('&')) {
        const i = part.indexOf('=');
        if (i < 0) continue;
        const k = part.slice(0, i), v = part.slice(i + 1);
        if (k === 'p') {
            isSetup = true;
            const places = (v ? v.split('~') : []).map((tok) => {
                const [z, name = '', hrs = ''] = tok.split('_');
                const zone = decZone(z);
                if (!canon(zone)) return null;
                return {
                    name: decName(name).trim().slice(0, 60) || cityOf(zone),
                    timeZone: zone,
                    hours: hrs ? decHours(hrs) : null,
                };
            }).filter(Boolean);
            out.locations = JSON.stringify(places.map((l, n) => ({
                id: 'clock-' + n, name: l.name, timeZone: l.timeZone, ...(l.hours && { hours: l.hours }),
            })));
        } else if (k === 'h') {
            const h = decHours(v);
            if (h && !sameHours(h, DEFAULT_HOURS)) out.hours = JSON.stringify(h);
        } else if (k === 'f') {
            if (v === '12') out.hourFormat = '12';
        } else if (k === 'o') {
            for (const [c, key] of Object.entries(OPT_LETTERS)) {
                const on = v.includes(c);
                if (on !== TOGGLES[key]) out[key] = JSON.stringify(on);
            }
        } else if (k === 't') {
            if (THEMES.includes(v) && v !== 'auto') out.theme = v;
        } else if (k === 'b') {
            if (PROTECTIONS.includes(v) && v !== 'none') out.protection = v;
        } else if (k === 'l') {
            if (I18N[v]) out.lang = v;
        }
    }
    return isSetup ? out : null; // not one of our links without p=
}

// Writes { key: value|null } to localStorage; returns what was there before.
function writeSettings(values) {
    const before = {};
    for (const k in values) {
        before[k] = localStorage.getItem(k);
        if (values[k] == null) localStorage.removeItem(k);
        else localStorage.setItem(k, values[k]);
    }
    return before;
}

// ---------- Burn-in protection ----------

// A short colour sequence. 400 ms per colour keeps it under ~3 flashes per
// second (a common photosensitivity guideline).
function runFlashSequence() {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999';
    document.body.appendChild(overlay);
    const colors = ['white', 'green', 'blue', 'red', 'black'];
    let i = 0;
    const step = () => { overlay.style.background = colors[i++]; };
    step();
    const id = setInterval(step, 400);
    setTimeout(() => { clearInterval(id); overlay.remove(); }, 400 * colors.length);
}

// ---------- Offline ----------

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
