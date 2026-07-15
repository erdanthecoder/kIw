// CouchPlay icon set — inline SVG, stroke-based, monochrome (uses currentColor).
// No emoji anywhere in the product UI.
const ICONS = (() => {
  const wrap = (inner, filled) =>
    `<svg viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  return {
    logo: wrap(`<path d="M6 9h12a4 4 0 0 1 4 4v2a3 3 0 0 1-5.5 1.7L15 15H9l-1.5 1.7A3 3 0 0 1 2 15v-2a4 4 0 0 1 4-4z"/><path d="M7.5 12v2M6.5 13h2M16 12.5h.01M18.5 14.5h.01"/>`),
    tv: wrap(`<rect x="2" y="4.5" width="20" height="13.5" rx="2"/><path d="M8 21.5h8"/>`),
    phone: wrap(`<rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M10.5 18.5h3"/>`),
    trophy: wrap(`<path d="M8 4h8v5a4 4 0 0 1-8 0V4z"/><path d="M8 5H5a3 3 0 0 0 3 4M16 5h3a3 3 0 0 1-3 4"/><path d="M12 13v3M8.5 20h7M10 16.5h4a1 1 0 0 1 1 1V20H9v-2.5a1 1 0 0 1 1-1z"/>`),
    minecraft: wrap(`<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M12 12L4 7.5M12 12l8-4.5M12 12v9"/>`),
    obby: wrap(`<path d="M4 21V4"/><path d="M4 4.5h14l-3.5 4 3.5 4H4"/>`),
    flappy: wrap(`<path d="M4 13c0-3.3 2.9-6 6.5-6S17 9.7 17 13s-2.9 6-6.5 6S4 16.3 4 13z"/><path d="M7 12.5c1.5-2.5 5-2.5 6.5 0"/><path d="M17 12.5l4.5 1.2L18 16"/><circle cx="12.8" cy="10.8" r=".4" fill="currentColor"/>`),
    snake: wrap(`<path d="M19 6c0 3.8-14 2.2-14 7 0 3.4 6.5 3.6 10.5 3.6"/><circle cx="19" cy="6" r="2.2"/><circle cx="18.5" cy="5.4" r=".35" fill="currentColor"/>`),
    tanks: wrap(`<rect x="2.5" y="12.5" width="16" height="6" rx="3"/><rect x="7" y="8.5" width="7" height="4" rx="1"/><path d="M14 10.5h7.5"/>`),
    bomber: wrap(`<circle cx="10" cy="14" r="6.5"/><path d="M14.5 9.5L17 7"/><path d="M17.5 3.5L19 5M20.5 7.5h1.2M19.8 2.8l.9-.9"/>`),
    laser: wrap(`<circle cx="12" cy="12" r="6.5"/><path d="M12 2.5v3.5M12 18v3.5M2.5 12H6M18 12h3.5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>`),
    trivia: wrap(`<circle cx="12" cy="12" r="9"/><path d="M9.5 9.7c0-1.6 1.1-2.7 2.6-2.7s2.5 1 2.5 2.4c0 2.1-2.6 2.1-2.6 4.1"/><circle cx="12" cy="16.8" r=".7" fill="currentColor"/>`),
    draw: wrap(`<path d="M17 3.5l3.5 3.5L8.5 19 4 20l1-4.5L17 3.5z"/><path d="M15 5.5L18.5 9"/>`),
    reaction: wrap(`<path d="M13 2.5L4.5 14H10l-1 7.5L17.5 10H12l1-7.5z"/>`),
    soccer: wrap(`<circle cx="12" cy="12" r="9"/><path d="M12 7.5l4.2 3-1.6 5h-5.2l-1.6-5 4.2-3z"/><path d="M12 3v4.5M20.5 9.5l-4.3 1M18 19.5l-3.4-4M6 19.5l3.4-4M3.5 9.5l4.3 1"/>`),
    race: wrap(`<path d="M4.5 21.5v-17"/><path d="M4.5 4.5H19v9H4.5"/><path d="M9.3 4.5v9M14.2 4.5v9M4.5 9H19"/>`),
    pong: wrap(`<circle cx="12" cy="12" r="1.8" fill="currentColor"/><path d="M4.5 5.5C3 7.5 2.2 9.7 2.2 12s.8 4.5 2.3 6.5"/><path d="M19.5 5.5c1.5 2 2.3 4.2 2.3 6.5s-.8 4.5-2.3 6.5"/>`),
    tetris: wrap(`<rect x="3.5" y="13.5" width="5" height="5"/><rect x="9.5" y="13.5" width="5" height="5"/><rect x="15.5" y="13.5" width="5" height="5"/><rect x="9.5" y="7.5" width="5" height="5"/>`),
    blob: wrap(`<circle cx="10.5" cy="13.5" r="7"/><circle cx="19" cy="6.5" r="2.4"/><circle cx="8.5" cy="11.5" r=".5" fill="currentColor"/><circle cx="12.5" cy="11.5" r=".5" fill="currentColor"/>`),
    dodge: wrap(`<circle cx="7.5" cy="7.5" r="3.8"/><circle cx="17" cy="9.5" r="2.6"/><circle cx="10.5" cy="16.5" r="3.2"/>`),
  };
})();
