// UI strings. Both languages must have the same keys. `{name}`-style
// placeholders are filled by t(). Keys ending in Html are trusted markup.

const I18N = {
    en: {
        appTitle: 'World Clock',
        settingsTitle: 'Settings · World Clock',
        settings: 'Settings',
        fullscreen: 'Fullscreen (F)',
        exitFullscreen: 'Exit fullscreen (F)',
        next24: 'Next 24 hours',
        legendWork: 'Working hours',
        legendEdge: 'Morning & evening',
        legendNight: 'Night',
        now: 'Now',
        copyHint: 'Click a row to copy its times',
        copied: 'Copied: {text}',
        copyFailed: 'Could not copy: {text}',
        noPlaces: 'No places yet.',
        addCity: 'Add a city',
        yourTime: 'Your time',
        today: 'Today',
        tomorrow: 'Tomorrow',
        yesterday: 'Yesterday',
        sameTime: 'Same time as you',
        ahead: '{amount} ahead',
        behind: '{amount} behind',
        unitH: 'h',
        unitMin: 'min',
        dstForward: 'Clocks go forward {amount} on {day}',
        dstBack: 'Clocks go back {amount} on {day}',
        imported: 'Loaded a shared setup',
        undo: 'Undo',

        back: 'Clock',
        places: 'Places',
        placesHintHtml: 'Search for a city, a time zone like <em>America/Denver</em>, or an offset like <em>UTC+5</em>.',
        searchPlaceholder: 'Add a city…',
        noMatches: 'No matches',
        placesEmpty: 'No places yet. Search above to add one.',
        name: 'Name',
        moveUp: 'Move up',
        moveDown: 'Move down',
        remove: 'Remove {name}',
        hoursFor: 'Hours for {name}',
        customHours: 'Custom hours',
        customOn: 'Only for this place',
        customOff: 'Uses the default hours from the Hours section',
        hours: 'Hours',
        hoursHint: 'Sets the colours in the table: working hours, morning & evening inside your awake hours, and night outside them. Give a place its own hours with the clock button in its row.',
        workHours: 'Working hours',
        awakeHours: 'Awake hours',
        awakeNote: 'Morning & evening; night is outside these',
        rangeStart: '{label} start',
        rangeEnd: '{label} end',
        display: 'Display',
        theme: 'Theme',
        themeAuto: 'Auto',
        themeLight: 'Light',
        themeDark: 'Dark',
        themeHacker: 'Hacker',
        language: 'Language',
        langAuto: 'Auto',
        timeFormat: 'Time format',
        h24: '24-hour',
        h12: '12-hour',
        seconds: 'Show seconds',
        secondsNote: 'On the large clocks',
        showLocal: 'Show your time zone',
        showLocalNote: "Adds your own time first if it isn't one of your places",
        showClocks: 'Show clocks',
        showClocksNote: 'The large clocks above the table',
        protection: 'Screen protection',
        protNone: 'None',
        protGentle: 'Gentle',
        protFlash: 'Flashy',
        protNoneNote: 'Against burn-in on screens that are always on',
        protGentleNote: 'Moves everything a few pixels every couple of minutes',
        protFlashNote: 'Flashes the screen in colours every 30 minutes',
        preview: 'Preview',
        share: 'Share setup',
        shareNote: 'A link that sets up another screen or device the same way',
        shareBtn: 'Copy link',
        linkCopied: 'Copied!',
        copyThisLink: 'Copy this link:',
        reset: 'Reset settings',
        resetNote: 'Removes your places and preferences on this device',
        resetBtn: 'Reset…',
        resetConfirm: 'Reset all settings? Your places and preferences on this device will be removed.',
    },
    no: {
        appTitle: 'Verdensklokke',
        settingsTitle: 'Innstillinger · Verdensklokke',
        settings: 'Innstillinger',
        fullscreen: 'Fullskjerm (F)',
        exitFullscreen: 'Avslutt fullskjerm (F)',
        next24: 'De neste 24 timene',
        legendWork: 'Arbeidstid',
        legendEdge: 'Morgen og kveld',
        legendNight: 'Natt',
        now: 'Nå',
        copyHint: 'Klikk på en rad for å kopiere tidene',
        copied: 'Kopiert: {text}',
        copyFailed: 'Kunne ikke kopiere: {text}',
        noPlaces: 'Ingen steder ennå.',
        addCity: 'Legg til en by',
        yourTime: 'Din tid',
        today: 'I dag',
        tomorrow: 'I morgen',
        yesterday: 'I går',
        sameTime: 'Samme tid som deg',
        ahead: '{amount} foran',
        behind: '{amount} bak',
        unitH: 't',
        unitMin: 'min',
        dstForward: 'Klokka stilles frem {amount} {day}',
        dstBack: 'Klokka stilles tilbake {amount} {day}',
        imported: 'Lastet inn et delt oppsett',
        undo: 'Angre',

        back: 'Klokke',
        places: 'Steder',
        placesHintHtml: 'Søk etter en by, en tidssone som <em>America/Denver</em> eller en forskyvning som <em>UTC+5</em>.',
        searchPlaceholder: 'Legg til en by…',
        noMatches: 'Ingen treff',
        placesEmpty: 'Ingen steder ennå. Søk over for å legge til et.',
        name: 'Navn',
        moveUp: 'Flytt opp',
        moveDown: 'Flytt ned',
        remove: 'Fjern {name}',
        hoursFor: 'Tider for {name}',
        customHours: 'Egne tider',
        customOn: 'Bare for dette stedet',
        customOff: 'Bruker standardtidene fra Tider-delen',
        hours: 'Tider',
        hoursHint: 'Bestemmer fargene i tabellen: arbeidstid, morgen og kveld innenfor våken tid, og natt utenfor. Gi et sted egne tider med klokkeknappen i raden.',
        workHours: 'Arbeidstid',
        awakeHours: 'Våken tid',
        awakeNote: 'Morgen og kveld; natt er utenfor',
        rangeStart: '{label} start',
        rangeEnd: '{label} slutt',
        display: 'Visning',
        theme: 'Tema',
        themeAuto: 'Auto',
        themeLight: 'Lys',
        themeDark: 'Mørk',
        themeHacker: 'Hacker',
        language: 'Språk',
        langAuto: 'Auto',
        timeFormat: 'Klokkeformat',
        h24: '24 timer',
        h12: '12 timer',
        seconds: 'Vis sekunder',
        secondsNote: 'På de store klokkene',
        showLocal: 'Vis din tidssone',
        showLocalNote: 'Legger til din egen tid først hvis den ikke er blant stedene',
        showClocks: 'Vis klokker',
        showClocksNote: 'De store klokkene over tabellen',
        protection: 'Skjermbeskyttelse',
        protNone: 'Av',
        protGentle: 'Skånsom',
        protFlash: 'Blinkende',
        protNoneNote: 'Mot innbrenning på skjermer som alltid står på',
        protGentleNote: 'Flytter alt noen få piksler med et par minutters mellomrom',
        protFlashNote: 'Blinker skjermen i farger hvert 30. minutt',
        preview: 'Forhåndsvis',
        share: 'Del oppsett',
        shareNote: 'En lenke som setter opp en annen skjerm eller enhet på samme måte',
        shareBtn: 'Kopier lenke',
        linkCopied: 'Kopiert!',
        copyThisLink: 'Kopier denne lenken:',
        reset: 'Tilbakestill innstillinger',
        resetNote: 'Fjerner stedene og innstillingene dine på denne enheten',
        resetBtn: 'Tilbakestill…',
        resetConfirm: 'Tilbakestille alle innstillinger? Stedene og innstillingene dine på denne enheten blir fjernet.',
    },
};

// "auto" follows the browser: any Norwegian (nb/nn/no) gets Norwegian.
function browserLang() {
    return (navigator.languages || [navigator.language]).some((l) => /^(nb|nn|no)\b/i.test(l)) ? 'no' : 'en';
}
function getLangSetting() {
    const v = localStorage.getItem('lang');
    return I18N[v] ? v : 'auto';
}
function currentLang() {
    const v = getLangSetting();
    return v === 'auto' ? browserLang() : v;
}
// Locale for dates and times.
function locale() { return currentLang() === 'no' ? 'nb-NO' : 'en-GB'; }

function t(key, vars) {
    let s = I18N[currentLang()][key] ?? I18N.en[key] ?? key;
    if (vars) for (const k in vars) s = s.replace('{' + k + '}', vars[k]);
    return s;
}

// Fills data-i18n (text), data-i18n-html, data-i18n-title, data-i18n-aria and
// data-i18n-placeholder, sets <html lang> and the page title.
function applyI18n() {
    const root = document.documentElement;
    root.lang = currentLang() === 'no' ? 'nb' : 'en';
    if (root.dataset.title) document.title = t(root.dataset.title);
    for (const e of document.querySelectorAll('[data-i18n]')) e.textContent = t(e.dataset.i18n);
    for (const e of document.querySelectorAll('[data-i18n-html]')) e.innerHTML = t(e.dataset.i18nHtml);
    for (const e of document.querySelectorAll('[data-i18n-title]')) e.title = t(e.dataset.i18nTitle);
    for (const e of document.querySelectorAll('[data-i18n-aria]')) e.setAttribute('aria-label', t(e.dataset.i18nAria));
    for (const e of document.querySelectorAll('[data-i18n-placeholder]')) e.placeholder = t(e.dataset.i18nPlaceholder);
}
