/** Line icons for the overlay (24×24, drawn with the text color), so no UI depends on emoji fonts. */
const PATHS = {
  guide: '<path d="M4.5 3.5 19.5 10l-6.6 2.1-2.4 6.9z"/><path d="m13 12.2 5.5 5.5"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  volume: '<path d="M11 5 6.5 9H3.5v6h3L11 19z"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18.5 6a8.5 8.5 0 0 1 0 12"/>',
  muted: '<path d="M11 5 6.5 9H3.5v6h3L11 19z"/><path d="m16 9.5 5 5m0-5-5 5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  send: '<path d="M12 19V5M5.5 11.5 12 5l6.5 6.5"/>',
  chevron: '<path d="m9.5 6 6 6-6 6"/>',
} as const;

export type IconName = keyof typeof PATHS;

/** An inline SVG icon element. Decorative: give its button an aria-label. */
export function icon(name: IconName): SVGSVGElement {
  const tpl = document.createElement("template");
  tpl.innerHTML = `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${PATHS[name]}</svg>`;
  return tpl.content.firstChild as SVGSVGElement;
}
