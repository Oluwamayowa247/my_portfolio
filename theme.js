// The light and dark switch in the top bar. A page opens in whichever mode
// the visitor's device asks for; a choice made here is remembered and wins.
// The remembered choice is applied in the <head>, before anything is drawn.
(function () {
    'use strict';

    const WALL = { dark: '#0b0b0b', light: '#ffffff' };

    const root = document.documentElement;
    const button = document.querySelector('.js-theme');
    const deviceLight = window.matchMedia('(prefers-color-scheme: light)');

    function current() {
        return root.dataset.theme || (deviceLight.matches ? 'light' : 'dark');
    }

    // The button names the mode it would switch to, and the browser's own
    // bars take the wall's color.
    function show() {
        const theme = current();
        button.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
        document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => { meta.content = WALL[theme]; });
    }

    button.addEventListener('click', () => {
        const next = current() === 'dark' ? 'light' : 'dark';
        root.dataset.theme = next;
        // Where storage is blocked, the choice lasts until the page is left.
        try { localStorage.setItem('theme', next); } catch (error) {}
        show();
    });

    deviceLight.addEventListener('change', show);
    show();
})();
