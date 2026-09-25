const searchEl = document.getElementById('search');
const resultsEl = document.getElementById('results');
const placesEl = document.getElementById('places');
const placesEmptyEl = document.getElementById('places-empty');
const flashEl = document.getElementById('flash');

let places = getLocations();
let results = [];
let active = 0;

const ICONS = {
    up: '<path d="M6 15l6-6 6 6"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
    remove: '<path d="M6 6l12 12M18 6L6 18"/>',
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
        meta.dataset.zone = p.timeZone;
        main.append(name, meta);

        const actions = el('div', 'place-actions');
        const move = (d) => () => {
            [places[i], places[i + d]] = [places[i + d], places[i]];
            save();
            renderPlaces(i + d, d < 0 ? 'up' : 'down');
        };
        const up = iconButton('up', 'Move up', move(-1));
        const down = iconButton('down', 'Move down', move(1));
        up.disabled = i === 0;
        down.disabled = i === places.length - 1;
        actions.append(up, down, iconButton('remove', 'Remove ' + p.name, () => {
            places.splice(i, 1);
            save();
            renderPlaces();
        }));
        li.append(main, actions);
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
        const m = zoneMeta(meta.dataset.zone, now);
        meta.replaceChildren(el('span', null, m.where), el('span', 'chip', m.off), el('span', 'place-time', m.time));
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
        tickMeta();
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

flashEl.checked = getScreenFlash();
flashEl.addEventListener('change', () => setScreenFlash(flashEl.checked));
document.getElementById('preview').addEventListener('click', runFlashSequence);

renderFormat();
renderTheme();
renderPlaces();
setInterval(tickMeta, 5000);
addEventListener('pageshow', (e) => {
    if (e.persisted) { places = getLocations(); renderPlaces(); renderFormat(); renderTheme(); flashEl.checked = getScreenFlash(); }
});
