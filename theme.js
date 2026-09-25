// Loaded in <head> so the page never flashes the wrong theme. "auto" follows
// the system light/dark setting; the resolved theme goes on <html data-theme>.
(function () {
    const light = matchMedia('(prefers-color-scheme: light)');
    function applyTheme() {
        const t = localStorage.getItem('theme') || 'auto';
        document.documentElement.dataset.theme = t === 'auto' ? (light.matches ? 'light' : 'dark') : t;
    }
    applyTheme();
    light.addEventListener('change', applyTheme);
    addEventListener('storage', applyTheme);
    window.applyTheme = applyTheme;
})();
