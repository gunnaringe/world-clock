const searchEl = document.getElementById('search');
const resultsEl = document.getElementById('results');
const placesEl = document.getElementById('places');
const placesEmptyEl = document.getElementById('places-empty');

let places = getLocations();
let results = [];
let active = 0;
const openHours = new Set(); // places whose hours panel is expanded

const ICONS = {
    up: '<path d="M6 15l6-6 6 6"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
    remove: '<path d="M6 6l12 12M18 6L6 18"/>',
    hours: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
};

function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
}

function iconButton(kind, label, onClick) {
    const b = el('button', 'icon-btn small' + (kind === 'remove' ? ' danger' : ''));
    b.type = 'button';
    b.title = label;
    b.setAttribute('aria-label', label);
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[kind]}</svg>`;
    b.addEventListener('click', onClick);
    return b;
}

function zoneMeta(zone, now = new Date()) {
    const w = wall(zone, now);
    return {
        where: zone.replace(/_/g, ' '),
        off: offsetLabel(w.off),
        time: clockText(w, getHourFormat() === '12'),
    };
}

function save() {
    setLocations(places);
}

// ---------- Hours ----------

function hourSelect(value, label, onChange) {
    const s = el('select', 'hour-select');
    s.setAttribute('aria-label', label);
    const h12 = getHourFormat() === '12';
    for (let h = 0; h < 24; h++) {
        const o = el('option', null, clockText({ h, mi: 0 }, h12, true));
        o.value = h;
        s.append(o);
    }
    s.value = value;
    s.addEventListener('change', () => onChange(Number(s.value)));
    return s;
}

// Rows editing a DEFAULT_HOURS-shaped object in place; onChange after each edit.
function hoursEditor(hours, onChange) {
    const row = (title, note, startKey, endKey) => {
        const r = el('div', 'row');
        const label = el('span', 'row-label', title);
        if (note) label.append(el('small', null, note));
        const set = (k) => (v) => { hours[k] = v; onChange(); };
        const range = el('div', 'hour-range');
        range.append(
            hourSelect(hours[startKey], title + ' start', set(startKey)),
            el('span', 'hour-sep', '–'),
            hourSelect(hours[endKey], title + ' end', set(endKey)));
        r.append(label, range);
        return r;
    };
    const wrap = el('div', 'hours-editor');
    wrap.append(
        row('Working hours', null, 'workStart', 'workEnd'),
        row('Awake hours', 'Morning & evening; night is outside these', 'dayStart', 'dayEnd'));
    return wrap;
}

function renderGlobalHours() {
    const hours = getHours();
    document.getElementById('global-hours').replaceChildren(hoursEditor(hours, () => setHours(hours)));
}

function placeHoursPanel(p) {
    const panel = el('div', 'place-hours');
    const toggleRow = el('label', 'row flat');
    const label = el('span', 'row-label', 'Custom hours');
    label.append(el('small', null, p.hours ? 'Only for this place' : 'Uses the hours above'));
    const sw = el('span', 'switch');
    const input = el('input');
    input.type = 'checkbox';
    input.checked = !!p.hours;
    input.addEventListener('change', () => {
        p.hours = input.checked ? { ...getHours() } : null;
        save();
        panel.replaceWith(placeHoursPanel(p));
        tickMeta();
    });
    sw.append(input, el('span'));
    toggleRow.append(label, sw);
    panel.append(toggleRow);
    if (p.hours) panel.append(hoursEditor(p.hours, save));
    return panel;
}

// ---------- Places ----------

function renderPlaces(focusIndex, focusKind) {
    placesEmptyEl.hidden = places.length > 0;
    placesEl.replaceChildren(...places.map((p, i) => {
        const li = el('li', 'place');
        const main = el('div', 'place-main');
        const name = el('input', 'place-name');
        name.value = p.name;
        name.placeholder = cityOf(p.timeZone);
        name.setAttribute('aria-label', 'Name');
        name.addEventListener('input', () => { p.name = name.value; save(); });
        name.addEventListener('blur', () => {
            if (!name.value.trim()) { name.value = p.name = cityOf(p.timeZone); save(); }
        });
        const meta = el('div', 'place-meta');
        meta.dataset.index = i;
        main.append(name, meta);

        const actions = el('div', 'place-actions');
        const move = (d) => () => {
            [places[i], places[i + d]] = [places[i + d], places[i]];
            save();
            renderPlaces(i + d, d < 0 ? 'up' : 'down');
        };
        const hoursBtn = iconButton('hours', 'Hours for ' + p.name, () => {
            if (openHours.has(p)) openHours.delete(p); else openHours.add(p);
            renderPlaces();
            placesEl.children[i].querySelector('[aria-label^="Hours"]').focus();
        });
        hoursBtn.setAttribute('aria-expanded', String(openHours.has(p)));
        const up = iconButton('up', 'Move up', move(-1));
        const down = iconButton('down', 'Move down', move(1));
        up.disabled = i === 0;
        down.disabled = i === places.length - 1;
        actions.append(hoursBtn, up, down, iconButton('remove', 'Remove ' + p.name, () => {
            openHours.delete(p);
            places.splice(i, 1);
            save();
            renderPlaces();
        }));
        li.append(main, actions);
        if (openHours.has(p)) li.append(placeHoursPanel(p));
        return li;
    }));
    tickMeta();
    if (focusIndex != null) {
        const btn = placesEl.children[focusIndex]?.querySelector(`[aria-label="Move ${focusKind}"]`);
        (btn && !btn.disabled ? btn : placesEl.children[focusIndex]?.querySelector('.place-name'))?.focus();
    }
}

function tickMeta() {
    const now = new Date();
    for (const meta of placesEl.querySelectorAll('.place-meta')) {
        const p = places[meta.dataset.index];
        const m = zoneMeta(p.timeZone, now);
        meta.replaceChildren(el('span', null, m.where), el('span', 'chip', m.off), el('span', 'place-time', m.time));
        if (p.hours) meta.append(el('span', 'chip accent', 'Custom hours'));
    }
}

// ---------- Search ----------

function openResults(open) {
    resultsEl.hidden = !open;
    searchEl.setAttribute('aria-expanded', String(open));
}

function renderResults() {
    const q = searchEl.value;
    results = search(q);
    active = 0;
    if (!q.trim()) { openResults(false); return; }
    const now = new Date();
    if (!results.length) {
        resultsEl.replaceChildren(el('li', 'result none', 'No matches'));
    } else {
        resultsEl.replaceChildren(...results.map((r, i) => {
            const m = zoneMeta(r.zone, now);
            const li = el('li', 'result');
            li.id = 'result-' + i;
            li.setAttribute('role', 'option');
            const text = el('div', 'result-text');
            text.append(el('span', 'result-name', r.label), el('span', 'result-zone', m.where));
            li.append(text, el('span', 'chip', m.off), el('span', 'result-time', m.time));
            li.addEventListener('mousedown', (e) => e.preventDefault()); // keep focus in the input
            li.addEventListener('click', () => addPlace(r));
            li.addEventListener('mousemove', () => setActive(i));
            return li;
        }));
    }
    setActive(0);
    openResults(true);
}

function setActive(i) {
    active = i;
    [...resultsEl.children].forEach((li, j) => li.setAttribute('aria-selected', String(j === i)));
    const cur = results.length ? 'result-' + i : '';
    searchEl.setAttribute('aria-activedescendant', cur);
    if (cur) document.getElementById(cur).scrollIntoView({ block: 'nearest' });
}

function addPlace(r) {
    places.push({ name: r.label, timeZone: r.zone });
    save();
    searchEl.value = '';
    openResults(false);
    renderPlaces();
    const added = placesEl.lastElementChild;
    added.classList.add('added');
    added.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    searchEl.focus();
}

searchEl.addEventListener('input', renderResults);
searchEl.addEventListener('focus', () => { if (searchEl.value.trim()) renderResults(); });
searchEl.addEventListener('blur', () => openResults(false));
searchEl.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!results.length) return;
        e.preventDefault();
        if (resultsEl.hidden) { renderResults(); return; }
        const d = e.key === 'ArrowDown' ? 1 : -1;
        setActive((active + d + results.length) % results.length);
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (results[active]) addPlace(results[active]);
    } else if (e.key === 'Escape') {
        if (!resultsEl.hidden) { e.preventDefault(); openResults(false); }
    }
});

// ---------- Display ----------

function renderFormat() {
    for (const b of document.querySelectorAll('[data-format]')) {
        b.setAttribute('aria-checked', String(b.dataset.format === getHourFormat()));
    }
}

for (const b of document.querySelectorAll('[data-format]')) {
    b.addEventListener('click', () => {
        setHourFormat(b.dataset.format);
        renderFormat();
        renderGlobalHours();
        renderPlaces();
    });
}

function renderTheme() {
    const current = localStorage.getItem('theme') || 'auto';
    for (const b of document.querySelectorAll('[data-theme-choice]')) {
        b.setAttribute('aria-checked', String(b.dataset.themeChoice === current));
    }
}

for (const b of document.querySelectorAll('[data-theme-choice]')) {
    b.addEventListener('click', () => {
        localStorage.setItem('theme', b.dataset.themeChoice);
        applyTheme();
        renderTheme();
    });
}

function renderToggles() {
    for (const input of document.querySelectorAll('[data-toggle]')) input.checked = getToggle(input.dataset.toggle);
}

for (const input of document.querySelectorAll('[data-toggle]')) {
    input.addEventListener('change', () => setToggle(input.dataset.toggle, input.checked));
}
document.getElementById('preview').addEventListener('click', runFlashSequence);

renderFormat();
renderTheme();
renderToggles();
renderGlobalHours();
renderPlaces();

document.getElementById('reset').addEventListener('click', () => {
    if (!confirm('Reset all settings? Your places and preferences on this device will be removed.')) return;
    resetSettings();
    location.reload();
});
setInterval(tickMeta, 5000);
addEventListener('pageshow', (e) => {
    if (e.persisted) { places = getLocations(); renderPlaces(); renderFormat(); renderTheme(); renderToggles(); renderGlobalHours(); }
});
