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
    clampSelection(start);
    renderShared();
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

// "15:00–17:00 Trondheim · 06:00–08:00 San Jose · 19:30–21:30 Kolkata (Fri 14)".
function spanText(from, to, places) {
    const a = new Date(from), b = to ? new Date(to) : null;
    const local = wall(LOCAL, a);
    return places.map((loc) => {
        const w = wall(loc.timeZone, a);
        const day = dayDiff(w, local) ? ' (' + dayFmt(loc.timeZone).format(a) + ')' : '';
        return spanClock(loc.timeZone, a, b) + ' ' + loc.name + day;
    }).join(' · ');
}
const spanClock = (zone, a, b) => clockText(wall(zone, a), h12) + (b ? '–' + clockText(wall(zone, b), h12) : '');

// ---------- Selection ----------
//
// One block of hours in a row: `sel` holds the instants (ms) of the row it
// started on and the row at the other end, so it survives the table being
// rebuilt on the hour. A click selects a row; a click on another row selects
// the hours between; a click on the only selected row clears it; a click
// while a block is selected starts over. Shift-click and dragging with a
// mouse extend; Shift+arrows do the same from the keyboard.

const selbarEl = document.getElementById('selbar');
let sel = null;

// Large screens: the bar sits in the table heading. Small screens: it floats
// at the bottom, which needs it outside the card (its backdrop-filter would
// make `position: fixed` relative to the card).
const legendEl = document.querySelector('.planner-head .legend');
function placeSelbar() {
    if (fillScreen.matches) legendEl.before(selbarEl);
    else document.body.append(selbarEl);
}
fillScreen.addEventListener('change', placeSelbar);
placeSelbar();
const selRange = () => sel && [Math.min(sel.a, sel.b), Math.max(sel.a, sel.b)];
const rowAt = (at) => bodyEl.querySelector('tr[data-at="' + at + '"]');

function paintSelection() {
    const r = selRange();
    for (const tr of bodyEl.children) {
        const at = Number(tr.dataset.at);
        const on = !!r && at >= r[0] && at <= r[1];
        tr.classList.toggle('sel', on);
        tr.classList.toggle('sel-first', on && at === r[0]);
        tr.classList.toggle('sel-last', on && at === r[1]);
        tr.setAttribute('aria-selected', on);
    }
    bodyEl.classList.toggle('has-sel', !!r);
    const show = !!r;
    if (selbarEl.hidden === show) {
        selbarEl.hidden = !show;
        fitTable();
    }
    if (r) {
        const n = (r[1] - r[0]) / 3600e3 + 1;
        document.getElementById('selbar-text').textContent = n === 1
            ? spanClock(LOCAL, selStart())
            : spanClock(LOCAL, new Date(r[0]), new Date(r[1] + 3600e3)) + ' · ' + duration(n * 60);
    }
}

// The moment a single selected row stands for: the "now" row is right now.
function selStart() {
    const r = selRange();
    const tr = rowAt(r[0]);
    return tr && tr.classList.contains('now') ? new Date(Math.floor(Date.now() / 60e3) * 60e3) : new Date(r[0]);
}

function setSel(next) {
    sel = next;
    paintSelection();
}

function clickRow(at, extend) {
    if (extend && sel) setSel({ a: sel.a, b: at });
    else if (sel && sel.a === sel.b && !extend) setSel(at === sel.a ? null : { a: sel.a, b: at });
    else setSel({ a: at, b: at });
}

// After the table is rebuilt: drop hours that went by, keep the rest.
function clampSelection(start) {
    const r = selRange();
    if (!r) return;
    const last = start + 23 * 3600e3;
    if (r[1] < start || r[0] > last) sel = null;
    else sel = { a: Math.max(r[0], start), b: Math.min(r[1], last) };
    paintSelection();
}

function selText() {
    const r = selRange();
    return r[0] === r[1] ? rowText(rowAt(r[0])) : spanText(r[0], r[1] + 3600e3, locations);
}

function flashSelection() {
    for (const tr of bodyEl.querySelectorAll('tr.sel')) {
        tr.classList.remove('copied');
        void tr.offsetWidth;
        tr.classList.add('copied');
        setTimeout(() => tr.classList.remove('copied'), 600);
    }
}

async function copySelection() {
    if (!sel) return;
    const text = selText();
    flashSelection();
    try {
        await navigator.clipboard.writeText(text);
        showToast(t('copied', { text }));
    } catch {
        showToast(t('copyFailed', { text }), null, 10000);
    }
}

// Share dialog: pick which of your places go into the link. Places left out
// stay left out (by zone) until the page is reloaded.
const shareDialog = document.getElementById('share-dialog');
const shareNativeBtn = document.getElementById('share-native');
const shareLeftOut = new Set();
let shareSpan = null; // { start, hours, end }

function sharePlaces() {
    return locations.filter((l) => !shareLeftOut.has(canon(l.timeZone)));
}
function shareLink() {
    return timeUrl(shareSpan.start, shareSpan.hours, sharePlaces());
}
function syncShareDialog() {
    document.getElementById('share-url').textContent = shareLink();
}

function openShare() {
    if (!sel) return;
    const r = selRange();
    const hours = r[0] === r[1] ? 0 : (r[1] - r[0]) / 3600e3 + 1;
    const start = hours ? r[0] : selStart().getTime();
    shareSpan = { start, hours, end: hours ? r[1] + 3600e3 : 0 };
    const a = new Date(start), b = hours ? new Date(shareSpan.end) : null;
    const date = fmt('sdate|' + locale(), () => new Intl.DateTimeFormat(locale(), {
        weekday: 'short', day: 'numeric', month: 'short',
    })).format(a);
    document.getElementById('share-span').textContent =
        date + ', ' + t('yourTimeSuffix', { time: spanClock(LOCAL, a, b) });
    const local = wall(LOCAL, a);
    document.getElementById('share-places').replaceChildren(...locations.map((loc) => {
        const zone = canon(loc.timeZone);
        const li = el('li');
        const label = el('label', 'share-place');
        const box = el('input');
        box.type = 'checkbox';
        box.checked = !shareLeftOut.has(zone);
        box.addEventListener('change', () => {
            if (box.checked) shareLeftOut.delete(zone); else shareLeftOut.add(zone);
            syncShareDialog();
        });
        label.append(box, el('span', 'sp-name', loc.name), el('span', 'sp-time', spanClock(loc.timeZone, a, b)));
        if (dayDiff(wall(loc.timeZone, a), local)) label.append(el('span', 'day', dayFmt(loc.timeZone).format(a)));
        li.append(label);
        return li;
    }));
    shareNativeBtn.hidden = !navigator.share;
    syncShareDialog();
    shareDialog.showModal();
}

document.getElementById('share-copy').addEventListener('click', async () => {
    const url = shareLink();
    shareDialog.close();
    flashSelection();
    try {
        await navigator.clipboard.writeText(url);
        showToast(t('linkCopiedToast'));
    } catch {
        showToast(t('copyThisLink') + ' ' + url, null, 15000);
    }
});
shareNativeBtn.addEventListener('click', async () => {
    const text = spanText(shareSpan.start, shareSpan.end, sharePlaces());
    try {
        await navigator.share({ url: shareLink(), text });
        shareDialog.close();
    } catch {}
});
// A click on the backdrop closes the dialog.
shareDialog.addEventListener('click', (e) => { if (e.target === shareDialog) shareDialog.close(); });

document.getElementById('sel-copy').addEventListener('click', copySelection);
document.getElementById('sel-share').addEventListener('click', openShare);
document.getElementById('sel-clear').addEventListener('click', () => setSel(null));

let drag = null, dragged = false;
bodyEl.addEventListener('pointerdown', (e) => {
    dragged = false;
    const tr = e.target.closest('tr');
    drag = tr && e.pointerType === 'mouse' && e.button === 0 && !e.shiftKey ? Number(tr.dataset.at) : null;
});
bodyEl.addEventListener('pointerover', (e) => {
    const tr = e.target.closest('tr');
    if (drag == null || !tr || !(e.buttons & 1)) return;
    const at = Number(tr.dataset.at);
    if (at === drag && !dragged) return;
    dragged = true;
    if (!sel || sel.a !== drag || sel.b !== at) setSel({ a: drag, b: at });
});
addEventListener('pointerup', () => { drag = null; });
bodyEl.addEventListener('click', (e) => {
    const tr = e.target.closest('tr');
    if (dragged || !tr) return;
    clickRow(Number(tr.dataset.at), e.shiftKey);
});
bodyEl.addEventListener('keydown', (e) => {
    const tr = e.target.closest('tr');
    if (!tr) return;
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        clickRow(Number(tr.dataset.at), e.shiftKey);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const next = e.key === 'ArrowDown' ? tr.nextElementSibling : tr.previousElementSibling;
        if (!next) return;
        e.preventDefault();
        next.focus();
        if (e.shiftKey) {
            const at = Number(tr.dataset.at);
            setSel({ a: sel ? sel.a : at, b: Number(next.dataset.at) });
        }
    }
});
addEventListener('keydown', (e) => {
    if (shareDialog.open) return; // Esc there closes the dialog, nothing more
    if (e.key === 'Escape' && sel) setSel(null);
    else if ((e.key === 'c' || e.key === 'C') && (e.ctrlKey || e.metaKey) && sel
        && !String(getSelection()).trim() && !e.target.closest('input, textarea')) {
        e.preventDefault();
        copySelection();
    }
});

// ---------- A shared time (from someone's link) ----------

const sharedEl = document.getElementById('shared');
let shared = null;

function renderShared() {
    sharedEl.hidden = !shared;
    if (!shared) return;
    const a = new Date(shared.start);
    const b = shared.hours ? new Date(shared.start + shared.hours * 3600e3) : null;
    const date = fmt('sdate|' + locale(), () => new Intl.DateTimeFormat(locale(), {
        weekday: 'short', day: 'numeric', month: 'short',
    })).format(a);
    document.getElementById('shared-when').textContent =
        date + ', ' + t('yourTimeSuffix', { time: spanClock(LOCAL, a, b) });
    const now = Date.now();
    const end = b ? b.getTime() : shared.start + 60e3;
    const min = Math.round((shared.start - now) / 60e3);
    document.getElementById('shared-status').textContent =
        end <= now ? t('hasPassed')
        : shared.start <= now ? t('happeningNow')
        : min >= 48 * 60 ? t('inAmount', { amount: Math.floor(min / 1440) + ' ' + t('unitDays') })
        : t('inAmount', { amount: duration(min) });
    sharedEl.classList.toggle('passed', end <= now);
    // The sender's places first, then yours, each zone once; your own zone is
    // already in the heading.
    const seen = new Set([LOCAL]);
    const places = [...shared.places, ...locations].filter((l) => {
        const z = canon(l.timeZone);
        if (seen.has(z)) return false;
        seen.add(z);
        return true;
    });
    const local = wall(LOCAL, a);
    document.getElementById('shared-places').replaceChildren(...places.map((loc) => {
        const li = el('li');
        li.append(el('span', 'sp-time', spanClock(loc.timeZone, a, b)), el('span', 'sp-name', loc.name));
        if (dayDiff(wall(loc.timeZone, a), local)) li.append(el('span', 'day', dayFmt(loc.timeZone).format(a)));
        return li;
    }));
}

// Select the rows a shared time covers, if they're in the table.
function selectShared() {
    if (!shared || plannerHour == null) return;
    const first = plannerHour, last = plannerHour + 23 * 3600e3;
    const rowOf = (ms) => first + Math.floor((ms - first) / 3600e3) * 3600e3;
    const lo = rowOf(shared.start);
    const hi = shared.hours ? rowOf(shared.start + shared.hours * 3600e3 - 1) : lo;
    if (hi < first || lo > last) return;
    setSel({ a: Math.max(lo, first), b: Math.min(hi, last) });
}

document.getElementById('shared-close').addEventListener('click', () => {
    shared = null;
    history.replaceState(null, '', location.href.split('#')[0]);
    renderShared();
    setSel(null);
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
    if (Math.floor(now / 60e3) !== tick.minute) {
        tick.minute = Math.floor(now / 60e3);
        if (shared) renderShared();
        if (sel) paintSelection();
    }
    checkForUpdate(now);
    applyDim(now);
    clearTimeout(tick.timer);
    tick.timer = setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
}

const range = (a, b) => clockText({ h: a, mi: 0 }, h12, true) + '–' + clockText({ h: b, mi: 0 }, h12, true);

function renderLegend() {
    document.getElementById('legend-work').textContent = range(hours.workStart, hours.workEnd);
    document.getElementById('legend-night').textContent = range(hours.dayEnd, hours.dayStart);
}

// ---------- Screen protection ----------

// Gentle: the picture wanders up to 1 % of the screen (about 11 px at 1080p,
// 22 px at 4K) in any direction, one pixel every 30 seconds, so the edges of
// text, cards and cells don't sit on the same pixels for hours. Too slow to
// notice; whole pixels so text stays sharp.
const SHIFT_STEP_MS = 30e3;
let protectTimer;
let shift = { x: 0, y: 0 }, shiftTarget = { x: 0, y: 0 };
function setShift(x, y) {
    shift = { x, y };
    document.documentElement.style.setProperty('--shift-x', x + 'px');
    document.documentElement.style.setProperty('--shift-y', y + 'px');
}
function stepShift() {
    const max = Math.max(1, Math.round(Math.min(innerWidth, innerHeight) / 100));
    if (shift.x === shiftTarget.x && shift.y === shiftTarget.y) {
        const r = () => Math.round((Math.random() * 2 - 1) * max);
        shiftTarget = { x: r(), y: r() };
    }
    const toward = (a, b) => a + Math.sign(b - a);
    setShift(toward(shift.x, shiftTarget.x), toward(shift.y, shiftTarget.y));
}
function applyProtection() {
    clearInterval(protectTimer);
    if (getProtection() === 'gentle') {
        protectTimer = setInterval(stepShift, SHIFT_STEP_MS);
    } else {
        setShift(0, 0);
        shiftTarget = { x: 0, y: 0 };
    }
}

// Dim outside working hours (and all weekend) on this device's clock. Using
// the screen brightens it again for a minute.
const WAKE_MS = 60e3;
let lastActive = -Infinity;
function shouldDim(now) {
    if (!getToggle('dim') || Date.now() - lastActive < WAKE_MS) return false;
    const day = now.getDay();
    return day === 0 || day === 6 || !inRange(now.getHours(), hours.workStart, hours.workEnd);
}
function applyDim(now = new Date()) {
    document.body.classList.toggle('dimmed', shouldDim(now));
}
for (const ev of ['mousemove', 'pointerdown', 'keydown']) {
    addEventListener(ev, () => {
        lastActive = Date.now();
        if (document.body.classList.contains('dimmed')) applyDim();
    });
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
    applyDim();
    syncFullscreenLabel();
    syncIdle();
}

// ---------- Shared setup links ----------

// Applies a setup link from the address bar, if any, and strips it.
function takeHash() {
    if (location.hash.length <= 1) return;
    // A shared time stays in the address bar until it's closed, so a reload
    // or a bookmark keeps it.
    const time = decodeTime(location.hash.slice(1));
    if (time) {
        shared = time;
        renderShared();
        selectShared();
        fitTable();
        if (!fillScreen.matches) sharedEl.scrollIntoView({ block: 'start' });
        return;
    }
    const values = decodeSetup(location.hash.slice(1));
    history.replaceState(null, '', location.href.split('#')[0]);
    if (!values) return;
    // Signage loads the same link on every start, so say nothing when it
    // changes nothing; and a signage screen has nobody to press Undo.
    const changed = Object.keys(values).some((k) => values[k] !== localStorage.getItem(k));
    const before = writeSettings(values);
    applyTheme();
    renderAll();
    if (!changed || getToggle('signage')) return;
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

// In fullscreen and in signage mode, hide the top bar and cursor after a few
// seconds without mouse movement. Signage starts hidden: nobody may ever move
// a mouse there.
let idleTimer;
const hidesControls = () => !!document.fullscreenElement || getToggle('signage');
function wake() {
    document.body.classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => document.body.classList.add('idle'), 3000);
}
function syncIdle() {
    clearTimeout(idleTimer);
    document.body.classList.toggle('idle', getToggle('signage'));
}
for (const ev of ['mousemove', 'pointerdown', 'keydown']) {
    addEventListener(ev, () => { if (hidesControls()) wake(); });
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
        else syncIdle();
    });
    document.addEventListener('visibilitychange', syncWakeLock);
}

// ---------- Start ----------

renderAll();
takeHash();
// Coming back from settings with the Back button restores a cached page.
addEventListener('pageshow', (e) => { if (e.persisted) renderAll(); });
addEventListener('storage', renderAll);
addEventListener('hashchange', takeHash);
