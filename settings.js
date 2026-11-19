const searchEl = document.getElementById('search');
const resultsEl = document.getElementById('results');
const placesEl = document.getElementById('places');
const placesEmptyEl = document.getElementById('places-empty');

let places = getLocations();
let results = [];
let active = 0;
const openHours = new Set(); // places whose hours panel is expanded

const ICONS = {
    grip: '<circle cx="9" cy="6" r="1.3"/><circle cx="15" cy="6" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="9" cy="18" r="1.3"/><circle cx="15" cy="18" r="1.3"/>',
    remove: '<path d="M6 6l12 12M18 6L6 18"/>',
    hours: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
};

function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
}

// `kind` doubles as data-action, which is how focus is found again after a re-render.
function iconButton(kind, label, onClick) {
    const b = el('button', 'icon-btn small' + (kind === 'remove' ? ' danger' : ''));
    b.type = 'button';
    b.dataset.action = kind;
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
    const row = (titleKey, noteKey, startKey, endKey) => {
        const title = t(titleKey);
        const r = el('div', 'row');
        r.dataset.range = startKey;
        const label = el('span', 'row-label', title);
        if (noteKey) label.append(el('small', null, t(noteKey)));
        const set = (k) => (v) => { hours[k] = v; onChange(); };
        const range = el('div', 'hour-range');
        range.append(
            hourSelect(hours[startKey], t('rangeStart', { label: title }), set(startKey)),
            el('span', 'hour-sep', '–'),
            hourSelect(hours[endKey], t('rangeEnd', { label: title }), set(endKey)));
        r.append(label, range);
        return r;
    };
    const wrap = el('div', 'hours-editor');
    wrap.append(
        row('workHours', null, 'workStart', 'workEnd'),
        row('awakeHours', 'awakeNote', 'dayStart', 'dayEnd'));
    return wrap;
}

function renderGlobalHours() {
    const hours = getHours();
    document.getElementById('global-hours').replaceChildren(hoursEditor(hours, () => setHours(hours)));
}

function placeHoursPanel(p) {
    const panel = el('div', 'place-hours');
    const toggleRow = el('label', 'row flat');
    const label = el('span', 'row-label', t('customHours'));
    label.append(el('small', null, t(p.hours ? 'customOn' : 'customOff')));
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

function movePlace(from, to) {
    if (to === from || to < 0 || to >= places.length) return;
    places.splice(to, 0, places.splice(from, 1)[0]);
    save();
    renderPlaces(to, 'grip');
}

function removePlace(i) {
    const p = places[i];
    openHours.delete(p);
    places.splice(i, 1);
    save();
    renderPlaces();
    showToast(t('removed', { name: p.name }), {
        label: t('undo'),
        run: () => {
            const at = Math.min(i, places.length);
            places.splice(at, 0, p);
            save();
            renderPlaces(at, 'remove');
        },
    }, 6000);
}

function renderPlaces(focusIndex, focusAction) {
    placesEmptyEl.hidden = places.length > 0;
    placesEl.replaceChildren(...places.map((p, i) => {
        const li = el('li', 'place');
        const grip = iconButton('grip', t('reorder', { name: p.name }), () => {});
        grip.classList.add('grip');
        grip.addEventListener('pointerdown', (e) => startDrag(e, li, i));
        grip.addEventListener('keydown', (e) => {
            const to = { ArrowUp: i - 1, ArrowDown: i + 1, Home: 0, End: places.length - 1 }[e.key];
            if (to == null) return;
            e.preventDefault();
            movePlace(i, to);
        });
        const name = el('input', 'place-name');
        name.value = p.name;
        name.placeholder = cityOf(p.timeZone);
        name.setAttribute('aria-label', t('name'));
        name.addEventListener('input', () => { p.name = name.value; save(); });
        name.addEventListener('blur', () => {
            if (!name.value.trim()) { name.value = p.name = cityOf(p.timeZone); save(); }
        });
        const meta = el('div', 'place-meta');
        meta.dataset.index = i;

        const actions = el('div', 'place-actions');
        const hoursBtn = iconButton('hours', t('hoursFor', { name: p.name }), () => {
            if (openHours.has(p)) openHours.delete(p); else openHours.add(p);
            renderPlaces(i, 'hours');
        });
        hoursBtn.setAttribute('aria-expanded', String(openHours.has(p)));
        actions.append(hoursBtn, iconButton('remove', t('remove', { name: p.name }), () => removePlace(i)));
        li.append(grip, name, actions, meta);
        if (openHours.has(p)) li.append(placeHoursPanel(p));
        return li;
    }));
    tickMeta();
    if (focusIndex != null) {
        const li = placesEl.children[focusIndex];
        const btn = li?.querySelector(`[data-action="${focusAction}"]`);
        (btn && !btn.disabled ? btn : li?.querySelector('.place-name'))?.focus();
    }
}

// Drag a place by its grip (mouse, touch or pen). The place follows the
// pointer, the others slide aside, and it lands where it's let go. Near the
// top or bottom of the window the page scrolls along.
function startDrag(e, li, from) {
    if (e.button !== 0 || places.length < 2) return;
    e.preventDefault();
    const grip = e.currentTarget;
    grip.setPointerCapture(e.pointerId);
    grip.focus({ preventScroll: true });
    const items = [...placesEl.children];
    const centres = items.map((x) => { const r = x.getBoundingClientRect(); return r.top + scrollY + r.height / 2; });
    const gap = parseFloat(getComputedStyle(placesEl).rowGap) || 0;
    const step = li.getBoundingClientRect().height + gap;
    const startY = e.clientY + scrollY;
    let y = e.clientY;
    let to = from;
    let frame;
    li.classList.add('dragging');
    placesEl.classList.add('sorting');

    const update = () => {
        const dy = y + scrollY - startY;
        const centre = centres[from] + dy;
        to = from;
        for (let j = 0; j < from; j++) if (centre < centres[j]) { to = j; break; }
        for (let j = items.length - 1; j > from; j--) if (centre > centres[j]) { to = j; break; }
        li.style.translate = `0 ${dy}px`;
        items.forEach((x, j) => {
            if (j === from) return;
            const shift = j >= to && j < from ? step : j <= to && j > from ? -step : 0;
            x.style.translate = shift ? `0 ${shift}px` : '';
        });
    };
    const scroll = () => {
        const edge = 56;
        const v = y < edge ? -(edge - y) / 4 : y > innerHeight - edge ? (y - innerHeight + edge) / 4 : 0;
        if (v) { scrollBy(0, v); update(); }
        frame = requestAnimationFrame(scroll);
    };
    frame = requestAnimationFrame(scroll);
    const move = (ev) => { y = ev.clientY; update(); };
    const end = (ev) => {
        cancelAnimationFrame(frame);
        grip.removeEventListener('pointermove', move);
        grip.removeEventListener('pointerup', end);
        grip.removeEventListener('pointercancel', end);
        placesEl.classList.remove('sorting');
        for (const x of items) x.style.translate = '';
        li.classList.remove('dragging');
        if (ev.type === 'pointerup' && to !== from) movePlace(from, to);
    };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', end);
    grip.addEventListener('pointercancel', end);
}

function tickMeta() {
    const now = new Date();
    for (const meta of placesEl.querySelectorAll('.place-meta')) {
        const p = places[meta.dataset.index];
        const m = zoneMeta(p.timeZone, now);
        meta.replaceChildren(el('span', null, m.where), el('span', 'chip', m.off), el('span', 'place-time', m.time));
        if (p.hours) meta.append(el('span', 'chip accent', t('customHours')));
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
        resultsEl.replaceChildren(el('li', 'result none', t('noMatches')));
    } else {
        resultsEl.replaceChildren(...results.map((r, i) => {
            const m = zoneMeta(r.zone, now);
            const li = el('li', 'result');
            li.id = 'result-' + i;
            li.setAttribute('role', 'option');
            const text = el('div', 'result-text');
            text.append(el('span', 'result-name', r.label), el('span', 'result-zone', m.where));
            li.append(text);
            if (indexOfZone(r.zone) >= 0) li.append(el('span', 'chip accent', t('inList')));
            li.append(el('span', 'chip', m.off), el('span', 'result-time', m.time));
            li.addEventListener('mousedown', (e) => e.preventDefault()); // keep focus in the input
            li.addEventListener('click', () => pickResult(r));
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

const indexOfZone = (zone) => places.findIndex((p) => canon(p.timeZone) === canon(zone));

// A zone already in the list is shown instead of added again; the toast
// still lets you add it (two offices in one zone, say).
function pickResult(r) {
    const i = indexOfZone(r.zone);
    if (i < 0) { addPlace(r); return; }
    searchEl.value = '';
    openResults(false);
    const li = placesEl.children[i];
    li.classList.remove('added');
    void li.offsetWidth; // restart the highlight
    li.classList.add('added');
    li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    showToast(t('alreadyInList', { name: places[i].name }), { label: t('addAnyway'), run: () => addPlace(r) }, 6000);
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
        if (results[active]) pickResult(results[active]);
    } else if (e.key === 'Escape') {
        if (!resultsEl.hidden) { e.preventDefault(); openResults(false); }
    }
});

// ---------- Display ----------

// Segmented controls: [data-<attr>] buttons reflecting get() and calling set().
function segmented(attr, get, set) {
    const buttons = document.querySelectorAll(`[data-${attr}]`);
    const key = attr.replace(/-(\w)/g, (_, c) => c.toUpperCase());
    const render = () => {
        for (const b of buttons) b.setAttribute('aria-checked', String(b.dataset[key] === get()));
    };
    for (const b of buttons) b.addEventListener('click', () => { set(b.dataset[key]); render(); });
    return render;
}

const renderFormat = segmented('format', getHourFormat, (v) => {
    setHourFormat(v);
    renderGlobalHours();
    renderPlaces();
});
const renderTheme = segmented('theme-choice', getTheme, (v) => {
    localStorage.setItem('theme', v);
    applyTheme();
});
const renderLang = segmented('lang-choice', getLangSetting, (v) => {
    localStorage.setItem('lang', v);
    renderAll();
});
const protectionEl = document.getElementById('protection');
protectionEl.addEventListener('change', () => setProtection(protectionEl.checked ? 'gentle' : 'none'));
function renderProtection() { protectionEl.checked = getProtection() === 'gentle'; }

function renderToggles() {
    for (const input of document.querySelectorAll('[data-toggle]')) input.checked = getToggle(input.dataset.toggle);
}

for (const input of document.querySelectorAll('[data-toggle]')) {
    input.addEventListener('change', () => setToggle(input.dataset.toggle, input.checked));
}

// ---------- Share and reset ----------

const shareBtn = document.getElementById('share');
shareBtn.addEventListener('click', async () => {
    const url = shareUrl();
    // Native share sheet on phones/tablets; clipboard elsewhere; and if both
    // fail, a prompt with the link ready to copy by hand.
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
        try {
            await navigator.share({ title: t('appTitle'), url });
            return;
        } catch (err) {
            if (err.name === 'AbortError') return;
        }
    }
    try {
        await navigator.clipboard.writeText(url);
        shareBtn.textContent = t('linkCopied');
        setTimeout(() => { shareBtn.textContent = t('shareBtn'); }, 2000);
    } catch {
        prompt(t('copyThisLink'), url);
    }
});

document.getElementById('reset').addEventListener('click', () => {
    if (!confirm(t('resetConfirm'))) return;
    resetSettings();
    location.reload();
});

// ---------- Start ----------

function renderAll() {
    applyI18n();
    renderFormat();
    renderTheme();
    renderLang();
    renderProtection();
    renderToggles();
    renderGlobalHours();
    renderPlaces();
}

renderAll();
setInterval(tickMeta, 5000);
addEventListener('pageshow', (e) => {
    if (e.persisted) { places = getLocations(); renderAll(); }
});
