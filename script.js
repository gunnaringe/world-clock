const clocksEl = document.getElementById('clocks');
const emptyEl = document.getElementById('empty');
const plannerEl = document.getElementById('planner');
const headerRow = document.getElementById('planner-header');
const bodyEl = document.getElementById('planner-body');

let locations = [];
let h12 = false;
let plannerHour = null; // start of the local hour the table was built for

const dateFmt = (zone) => fmt('date|' + zone, () => new Intl.DateTimeFormat('en-GB', {
    timeZone: zone, weekday: 'long', day: 'numeric', month: 'long',
}));
const dayFmt = (zone) => fmt('day|' + zone, () => new Intl.DateTimeFormat('en-GB', {
    timeZone: zone, weekday: 'short', day: 'numeric',
}));

// Calendar-day difference between two wall clocks (-1, 0, 1).
function dayDiff(a, b) {
    return Math.round((Date.UTC(a.y, a.mo - 1, a.d) - Date.UTC(b.y, b.mo - 1, b.d)) / 864e5);
}

function relativeText(min) {
    if (!min) return 'Same time as you';
    const a = Math.abs(min);
    const h = Math.floor(a / 60);
    const m = a % 60;
    const amount = (h ? h + ' h' : '') + (h && m ? ' ' : '') + (m ? m + ' min' : '');
    return amount + (min > 0 ? ' ahead' : ' behind');
}

function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
}

function renderClocks() {
    clocksEl.replaceChildren(...locations.map((loc) => {
        const card = el('article', 'clock card');
        const head = el('div', 'clock-head');
        head.append(el('h2', 'clock-name', loc.name), el('span', 'chip clock-offset'));
        const time = el('p', 'clock-time');
        time.append(el('span', 'hm'), el('span', 'ap'));
        card.append(head, time, el('p', 'clock-date'), el('p', 'clock-rel'));
        if (canon(loc.timeZone) === LOCAL) card.classList.add('is-local');
        return card;
    }));
    clocksEl.dataset.count = Math.min(locations.length, 7);
}

function tickClocks(now) {
    const local = wall(LOCAL, now);
    [...clocksEl.children].forEach((card, i) => {
        const zone = locations[i].timeZone;
        const w = wall(zone, now);
        const text = clockText(w, h12);
        const [hm, ap = ''] = text.split(' ');
        card.querySelector('.hm').textContent = hm;
        card.querySelector('.ap').textContent = ap;
        card.querySelector('.clock-offset').textContent = offsetLabel(w.off);
        const diff = dayDiff(w, local);
        const rel = diff > 0 ? 'Tomorrow' : diff < 0 ? 'Yesterday' : 'Today';
        card.querySelector('.clock-date').textContent = dateFmt(zone).format(now);
        card.querySelector('.clock-rel').textContent =
            canon(zone) === LOCAL ? 'Your time' : rel + ' · ' + relativeText(w.off - local.off);
        card.dataset.band = band(w.h);
    });
}

function renderPlanner(start) {
    plannerHour = start;
    headerRow.replaceChildren(...locations.map((loc) => {
        const th = el('th');
        th.scope = 'col';
        th.append(el('span', 'th-name', loc.name), el('span', 'th-off', offsetLabel(wall(loc.timeZone, new Date(start)).off)));
        return th;
    }));

    const local = wall(LOCAL, new Date(start));
    const prev = locations.map(() => null);
    const rows = [];
    for (let i = 0; i < 24; i++) {
        const at = new Date(start + i * 3600e3);
        const tr = el('tr');
        if (i === 0) tr.className = 'now';
        locations.forEach((loc, c) => {
            const w = wall(loc.timeZone, at);
            const td = el('td', band(w.h));
            td.append(el('span', 't', clockText(w, h12, true)));
            // Mark where a column crosses into a new day, and the first row if
            // that place is already on a different day than you.
            const newDay = prev[c] ? prev[c].d !== w.d : dayDiff(w, local) !== 0;
            if (newDay) td.append(el('span', 'day', dayFmt(loc.timeZone).format(at)));
            prev[c] = w;
            tr.append(td);
        });
        rows.push(tr);
    }
    bodyEl.replaceChildren(...rows);
}

function startOfLocalHour(now) {
    const w = wall(LOCAL, now);
    return now.getTime() - (w.mi * 60 + w.s) * 1000 - now.getMilliseconds();
}

function tick() {
    const now = new Date();
    tickClocks(now);
    const start = startOfLocalHour(now);
    if (start !== plannerHour) renderPlanner(start);
    clearTimeout(tick.timer);
    tick.timer = setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
}

function renderAll() {
    locations = getLocations();
    h12 = getHourFormat() === '12';
    emptyEl.hidden = locations.length > 0;
    plannerEl.hidden = locations.length === 0;
    renderClocks();
    plannerHour = null;
    tick();

    clearInterval(renderAll.flash);
    if (getScreenFlash()) renderAll.flash = setInterval(runFlashSequence, 30 * 60e3);
}

renderAll();
// Coming back from settings with the Back button restores a cached page.
addEventListener('pageshow', (e) => { if (e.persisted) renderAll(); });
addEventListener('storage', renderAll);
