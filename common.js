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

function cityOf(zone) {
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

// Day band used for colouring: work hours, the edges of the day, and night.
function band(h) {
    if (h >= 8 && h < 17) return 'work';
    if (h === 7 || (h >= 17 && h < 23)) return 'edge';
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

const defaultLocations = [
    { id: 'clock-trondheim', name: 'Trondheim', timeZone: 'Europe/Oslo' },
    { id: 'clock-san-jose', name: 'San Jose', timeZone: 'America/Los_Angeles' },
];

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
    return (Array.isArray(list) ? list : defaultLocations)
        .filter((l) => l && canon(l.timeZone))
        .map((l) => ({ name: String(l.name || '').trim() || cityOf(l.timeZone), timeZone: l.timeZone }));
}

function setLocations(list) {
    localStorage.setItem('locations', JSON.stringify(
        list.map((l, i) => ({ id: 'clock-' + i, name: l.name, timeZone: l.timeZone }))));
}

function getHourFormat() { return localStorage.getItem('hourFormat') === '12' ? '12' : '24'; }
function setHourFormat(f) { localStorage.setItem('hourFormat', f); }
function getScreenFlash() { return readJSON('screenFlash', false) === true; }
function setScreenFlash(on) { localStorage.setItem('screenFlash', JSON.stringify(on)); }

// ---------- Burn-in protection ----------

function runFlashSequence() {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999';
    document.body.appendChild(overlay);
    const colors = ['white', 'green', 'blue', 'red', 'black'];
    let i = 0;
    const id = setInterval(() => { overlay.style.background = colors[i++ % colors.length]; }, 100);
    setTimeout(() => { clearInterval(id); overlay.remove(); }, 1000);
}
