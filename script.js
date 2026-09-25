const clocksEl = document.getElementById('clocks');
const emptyEl = document.getElementById('empty');
const plannerEl = document.getElementById('planner');
const headerRow = document.getElementById('planner-header');
const bodyEl = document.getElementById('planner-body');

let locations = [];
let h12 = false;
let seconds = false;
let hours = DEFAULT_HOURS;
const bandOf = (loc, h) => band(h, loc.hours || hours);
let plannerHour = null; // start of the local hour the table was built for
let shifts = [];        // upcoming DST change per location (or null), per planner hour

const dateFmt = (zone) => fmt('date|' + locale() + zone, () => new Intl.DateTimeFormat(locale(), {
    timeZone: zone, weekday: 'long', day: 'numeric', month: 'long',
}));
const dayFmt = (zone) => fmt('day|' + locale() + zone, () => new Intl.DateTimeFormat(locale(), {
    timeZone: zone, weekday: 'short', day: 'numeric',
}));
const weekdayFmt = (zone) => fmt('wday|' + locale() + zone, () => new Intl.DateTimeFormat(locale(), {
    timeZone: zone, weekday: 'long', day: 'numeric',
}));

// Calendar-day difference between two wall clocks (-1, 0, 1).
function dayDiff(a, b) {
    return Math.round((Date.UTC(a.y, a.mo - 1, a.d) - Date.UTC(b.y, b.mo - 1, b.d)) / 864e5);
}

// "3 h 30 min"
function duration(min) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return [h && h + ' ' + t('unitH'), m && m + ' ' + t('unitMin')].filter(Boolean).join(' ');
}

function relativeText(min) {
    if (!min) return t('sameTime');
    return t(min > 0 ? 'ahead' : 'behind', { amount: duration(Math.abs(min)) });
}

function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
}

// ---------- Daylight saving ----------

// The next offset change in a zone within a week of `start`, as
// { delta: minutes, at: Date } (at = first whole hour after the change).
function nextShift(zone, start) {
    const off0 = wall(zone, new Date(start)).off;
    for (let i = 1; i <= 7 * 24; i++) {
        const at = new Date(start + i * 3600e3);
        const off = wall(zone, at).off;
        if (off !== off0) return { delta: off - off0, at };
    }
    return null;
}

function shiftText(s, zone) {
    return t(s.delta > 0 ? 'dstForward' : 'dstBack', {
        amount: duration(Math.abs(s.delta)),
        day: weekdayFmt(zone).format(s.at),
    });
}

function shiftShort(s, zone) {
    return (s.delta > 0 ? '+' : MINUS) + duration(Math.abs(s.delta)) + ' ' + dayFmt(zone).format(s.at);
}

// ---------- Clocks ----------

function renderClocks() {
    clocksEl.replaceChildren(...locations.map((loc) => {
        const card = el('article', 'clock card');
        const head = el('div', 'clock-head');
        head.append(el('h2', 'clock-name', loc.name), el('span', 'chip clock-offset'));
        const time = el('p', 'clock-time');
        time.append(el('span', 'hm'), el('span', 'ss'), el('span', 'ap'));
        const dst = el('p', 'clock-dst');
        dst.hidden = true;
        card.append(head, time, el('p', 'clock-date'), el('p', 'clock-rel'), dst);
        if (canon(loc.timeZone) === LOCAL) card.classList.add('is-local');
        return card;
    }));
    clocksEl.dataset.count = Math.min(locations.length, 7);
    clocksEl.classList.toggle('with-seconds', seconds);
    // Columns when filling a large screen: one row up to six, then two rows.
    clocksEl.style.setProperty('--cols', locations.length <= 6 ? locations.length : Math.ceil(locations.length / 2));
}

function tickClocks(now) {
    const local = wall(LOCAL, now);
    [...clocksEl.children].forEach((card, i) => {
        const zone = locations[i].timeZone;
        const w = wall(zone, now);
        const [hm, ap = ''] = clockText(w, h12).split(' ');
        card.querySelector('.hm').textContent = hm;
        card.querySelector('.ss').textContent = seconds ? ':' + pad(w.s) : '';
        card.querySelector('.ap').textContent = ap;
        card.querySelector('.clock-offset').textContent = offsetLabel(w.off);
        const diff = dayDiff(w, local);
        const rel = t(diff > 0 ? 'tomorrow' : diff < 0 ? 'yesterday' : 'today');
        card.querySelector('.clock-date').textContent = dateFmt(zone).format(now);
        card.querySelector('.clock-rel').textContent =
            canon(zone) === LOCAL ? t('yourTime') : rel + ' · ' + relativeText(w.off - local.off);
        card.dataset.band = bandOf(locations[i], w.h);
    });
}

// ---------- Table ----------

function renderPlanner(start) {
    plannerHour = start;
    shifts = locations.map((loc) => nextShift(loc.timeZone, start));
    headerRow.replaceChildren(...locations.map((loc, c) => {
        const th = el('th');
        th.scope = 'col';
        th.append(el('span', 'th-name', loc.name), el('span', 'th-off', offsetLabel(wall(loc.timeZone, new Date(start)).off)));
        if (shifts[c]) {
            const d = el('span', 'th-dst', shiftShort(shifts[c], loc.timeZone));
            d.title = shiftText(shifts[c], loc.timeZone);
            th.append(d);
        }
        return th;
    }));
    [...clocksEl.children].forEach((card, c) => {
        const dst = card.querySelector('.clock-dst');
        dst.hidden = !shifts[c];
        dst.textContent = shifts[c] ? shiftText(shifts[c], locations[c].timeZone) : '';
    });

    const local = wall(LOCAL, new Date(start));
    const prev = locations.map(() => null);
    const rows = [];
    for (let i = 0; i < 24; i++) {
        const at = new Date(start + i * 3600e3);
        const tr = el('tr');
        tr.tabIndex = 0;
        tr.dataset.at = at.getTime();
        if (i === 0) tr.className = 'now';
        locations.forEach((loc, c) => {
            const w = wall(loc.timeZone, at);
            const td = el('td', bandOf(loc, w.h));
            td.append(el('span', 't', clockText(w, h12, true)));
            // Mark where a column crosses into a new day, and the first row if
            // that place is already on a different day than you.
            const newDay = prev[c] ? prev[c].d !== w.d : dayDiff(w, local) !== 0;
            if (newDay) td.append(el('span', 'day', dayFmt(loc.timeZone).format(at)));
            if (i === 0 && c === 0) td.dataset.now = t('now');
            prev[c] = w;
            tr.append(td);
        });
        rows.push(tr);
    }
    bodyEl.replaceChildren(...rows);
    fitTable();
}

// In the fill-the-screen layout, shrink the table text until all 24 rows fit
// (short laptop screens, or many places with the clocks in two rows).
const fillScreen = matchMedia('(min-width: 900px) and (min-height: 560px)');
function fitTable() {
    const box = bodyEl.closest('.table-scroll');
    const table = bodyEl.closest('table');
    table.style.removeProperty('--td-font');
    if (!fillScreen.matches) return;
    let px = parseFloat(getComputedStyle(bodyEl.querySelector('td') || table).fontSize);
    while (box.scrollHeight > box.clientHeight + 1 && px > 9) {
        px -= 0.5;
        table.style.setProperty('--td-font', px + 'px');
    }
}
let resizeTimer;
addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(fitTable, 100); });

function startOfLocalHour(now) {
    const w = wall(LOCAL, now);
    return now.getTime() - (w.mi * 60 + w.s) * 1000 - now.getMilliseconds();
}

// The first row is the current hour; show the actual time there, not hh:00.
function tickNowRow(now) {
    const row = bodyEl.firstElementChild;
    if (!row) return;
    [...row.children].forEach((td, c) => {
        const w = wall(locations[c].timeZone, now);
        td.querySelector('.t').textContent = clockText(w, h12);
        td.className = bandOf(locations[c], w.h);
    });
}

// Click (or Enter on) a row: copy "15:00 Trondheim · 06:00 San Jose · …".
function rowText(tr) {
    const at = tr.classList.contains('now') ? new Date() : new Date(Number(tr.dataset.at));
    const local = wall(LOCAL, at);
    return locations.map((loc) => {
        const w = wall(loc.timeZone, at);
        const day = dayDiff(w, local) ? ' (' + dayFmt(loc.timeZone).format(at) + ')' : '';
        return clockText(w, h12) + ' ' + loc.name + day;
    }).join(' · ');
}

async function copyRow(tr) {
    const text = rowText(tr);
    tr.classList.add('copied');
    setTimeout(() => tr.classList.remove('copied'), 600);
    try {
        await navigator.clipboard.writeText(text);
        showToast(t('copied', { text }));
    } catch {
        showToast(t('copyFailed', { text }), null, 10000);
    }
}

bodyEl.addEventListener('click', (e) => {
    const tr = e.target.closest('tr');
    if (tr) copyRow(tr);
});
bodyEl.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('tr')) {
        e.preventDefault();
        copyRow(e.target);
    }
});

// ---------- Toast ----------

const toastEl = document.getElementById('toast');
let toastTimer;
function showToast(text, action, ms = 4000) {
    document.getElementById('toast-text').textContent = text;
    const btn = document.getElementById('toast-action');
    btn.hidden = !action;
    if (action) {
        btn.textContent = action.label;
        btn.onclick = () => { hideToast(); action.run(); };
    }
    toastEl.hidden = false;
    requestAnimationFrame(() => toastEl.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, ms);
}
function hideToast() {
    toastEl.classList.remove('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 300);
}

// ---------- Tick ----------

function tick() {
    const now = new Date();
    tickClocks(now);
    const start = startOfLocalHour(now);
    if (start !== plannerHour) renderPlanner(start);
    tickNowRow(now);
    checkForUpdate(now);
    clearTimeout(tick.timer);
    tick.timer = setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
}

const range = (a, b) => clockText({ h: a, mi: 0 }, h12, true) + '–' + clockText({ h: b, mi: 0 }, h12, true);

function renderLegend() {
    document.getElementById('legend-work').textContent = range(hours.workStart, hours.workEnd);
    document.getElementById('legend-night').textContent = range(hours.dayEnd, hours.dayStart);
}

// ---------- Screen protection ----------

const SHIFT_PX = 3;
let protectTimer;
function setShift(x, y) {
    document.documentElement.style.setProperty('--shift-x', x + 'px');
    document.documentElement.style.setProperty('--shift-y', y + 'px');
}
function applyProtection() {
    clearInterval(protectTimer);
    setShift(0, 0);
    const mode = getProtection();
    if (mode === 'flash') {
        protectTimer = setInterval(runFlashSequence, 30 * 60e3);
    } else if (mode === 'gentle') {
        const r = () => Math.round((Math.random() * 2 - 1) * SHIFT_PX);
        protectTimer = setInterval(() => setShift(r(), r()), 2 * 60e3);
    }
}

// ---------- Render ----------

function renderAll() {
    applyI18n();
    locations = getLocations();
    // "Show your time zone": add it first unless one of the places already is.
    if (getToggle('showLocal') && !locations.some((l) => canon(l.timeZone) === LOCAL)) {
        locations.unshift({ name: cityOf(LOCAL), timeZone: LOCAL });
    }
    h12 = getHourFormat() === '12';
    seconds = getToggle('seconds');
    hours = getHours();
    renderLegend();
    emptyEl.hidden = locations.length > 0;
    plannerEl.hidden = locations.length === 0;
    clocksEl.hidden = !getToggle('showClocks');
    renderClocks();
    plannerHour = null;
    tick();
    applyProtection();
    syncFullscreenLabel();
}

// ---------- Shared setup links ----------

// Applies a setup link from the address bar, if any, and strips it.
function takeHash() {
    if (location.hash.length <= 1) return;
    const values = decodeSetup(location.hash.slice(1));
    history.replaceState(null, '', location.href.split('#')[0]);
    if (!values) return;
    const before = writeSettings(values);
    applyTheme();
    renderAll();
    showToast(t('imported'), {
        label: t('undo'),
        run: () => { writeSettings(before); applyTheme(); renderAll(); },
    }, 10000);
}

// ---------- Updates for screens that are never reloaded ----------
//
// Once a night (around 04:00 plus a few minutes of jitter) check whether the
// app files changed since this page loaded, and reload only then — a reload
// leaves fullscreen, so don't do it for nothing. If there was no baseline
// (loaded offline), reload anyway to get off the cached copy.

const APP_FILES = ['./', 'styles.css', 'i18n.js', 'common.js', 'theme.js', 'script.js'];
let baseline;
let nextCheck = nextFourAm(new Date());

function nextFourAm(now) {
    const d = new Date(now);
    d.setHours(4, 0, 0, 0);
    if (d <= now) d.setDate(d.getDate() + 1);
    return d.getTime() + Math.random() * 15 * 60e3;
}

async function fingerprint() {
    const texts = await Promise.all(APP_FILES.map((f) =>
        fetch(f, { cache: 'no-store' }).then((r) => (r.ok ? r.text() : Promise.reject(new Error(r.status))))));
    let h = 5381;
    for (const ch of texts.join('\0')) h = (h * 33 + ch.charCodeAt(0)) | 0;
    return h;
}

function checkForUpdate(now) {
    if (now.getTime() < nextCheck) return;
    nextCheck = nextFourAm(now);
    fingerprint().then((fp) => {
        if (baseline == null || fp !== baseline) location.reload();
    }, () => {}); // offline: try again tomorrow
}

setTimeout(() => fingerprint().then((fp) => { baseline = fp; }, () => { baseline = null; }), 10e3);

// ---------- Fullscreen (for wall screens) ----------

const fsBtn = document.getElementById('fullscreen');
const root = document.documentElement;
let wakeLock = null;

function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else root.requestFullscreen?.().catch(() => {});
}

function syncFullscreenLabel() {
    const key = document.fullscreenElement ? 'exitFullscreen' : 'fullscreen';
    fsBtn.dataset.i18nTitle = fsBtn.dataset.i18nAria = key;
    fsBtn.title = t(key);
    fsBtn.setAttribute('aria-label', t(key));
}

// Keep the screen awake while fullscreen; the lock is dropped when the tab is hidden.
async function syncWakeLock() {
    const want = !!document.fullscreenElement && document.visibilityState === 'visible';
    if (want && !wakeLock && navigator.wakeLock) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => { wakeLock = null; });
        } catch {}
    } else if (!want && wakeLock) {
        wakeLock.release();
    }
}

// Hide the top bar and cursor after a few seconds without mouse movement.
let idleTimer;
function wake() {
    document.body.classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => document.body.classList.add('idle'), 3000);
}

if (root.requestFullscreen) {
    fsBtn.hidden = false;
    fsBtn.addEventListener('click', toggleFullscreen);
    addEventListener('keydown', (e) => {
        if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey) toggleFullscreen();
    });
    document.addEventListener('fullscreenchange', () => {
        syncFullscreenLabel();
        syncWakeLock();
        if (document.fullscreenElement) wake();
        else { clearTimeout(idleTimer); document.body.classList.remove('idle'); }
    });
    document.addEventListener('visibilitychange', syncWakeLock);
    for (const ev of ['mousemove', 'pointerdown', 'keydown']) {
        addEventListener(ev, () => { if (document.fullscreenElement) wake(); });
    }
}

// ---------- Start ----------

renderAll();
takeHash();
// Coming back from settings with the Back button restores a cached page.
addEventListener('pageshow', (e) => { if (e.persisted) renderAll(); });
addEventListener('storage', renderAll);
addEventListener('hashchange', takeHash);
