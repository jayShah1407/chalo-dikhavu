/**
 * The guide's cursor. Five built-in styles drawn as SVG (the same on every device and
 * browser, unlike emoji), or the site's own: an SVG, an image, or a character.
 * Colored styles use the `color` option.
 */
export type CursorPreset = "arrow" | "brand" | "dot" | "spark" | "ring";

export interface CustomCursor {
  /** Your own SVG markup. Use `currentColor` to pick up the `color` option. */
  svg?: string;
  /** An image URL (PNG, SVG, GIF). */
  image?: string;
  /** A character or emoji, e.g. "👆". Looks different on each device. */
  text?: string;
  /** Width and height in px. Default 28. */
  size?: number;
  /** The point (in px from the top-left) that lands on the target. Default: the center. */
  hotspot?: [number, number];
}

export type CursorOption = CursorPreset | CustomCursor;

const ARROW = "M5 3 L5 22 L10 17.5 L13.5 25 L17 23.5 L13.6 16 L20.5 16 Z";

const PRESETS: Record<CursorPreset, { svg: string; hotspot: [number, number] }> = {
  // The classic pointer: white with a dark outline, readable on any page.
  arrow: { hotspot: [5, 3], svg: `<path d="${ARROW}" fill="#fff" stroke="#0f172a" stroke-width="1.6" stroke-linejoin="round"/>` },
  // The same pointer in your brand color.
  brand: { hotspot: [5, 3], svg: `<path d="${ARROW}" fill="currentColor" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/>` },
  // A soft glowing dot.
  dot: { hotspot: [14, 14], svg: '<circle cx="14" cy="14" r="12" fill="currentColor" opacity=".2"/><circle cx="14" cy="14" r="6.5" fill="currentColor" stroke="#fff" stroke-width="2.5"/>' },
  // A four-point sparkle, for an "assistant" feel.
  spark: { hotspot: [14, 14], svg: '<path d="M14 2.5C15 9.5 18.5 13 25.5 14 18.5 15 15 18.5 14 25.5 13 18.5 9.5 15 2.5 14 9.5 13 13 9.5 14 2.5Z" fill="currentColor" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>' },
  // A target ring with a center dot.
  ring: { hotspot: [14, 14], svg: '<circle cx="14" cy="14" r="9" fill="none" stroke="#fff" stroke-width="6"/><circle cx="14" cy="14" r="9" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="14" cy="14" r="2.75" fill="currentColor" stroke="#fff" stroke-width="1.2"/>' },
};

export const CURSOR_PRESETS = Object.keys(PRESETS) as CursorPreset[];

/** The cursor's drawing, sized and shifted so its hotspot sits on (0, 0). */
export function cursorShape(option: CursorOption | undefined): HTMLElement {
  const shape = document.createElement("span");
  shape.className = "shape";
  let size = 28;
  let hotspot: [number, number];
  if (typeof option === "object" && option) {
    size = Math.min(64, Math.max(12, option.size ?? 28));
    hotspot = option.hotspot ?? [size / 2, size / 2];
    if (option.svg) shape.innerHTML = option.svg;
    else if (option.image) {
      const img = document.createElement("img");
      img.src = option.image;
      img.alt = "";
      shape.append(img);
    } else {
      shape.classList.add("text");
      shape.style.fontSize = `${Math.round(size * 0.82)}px`;
      shape.textContent = option.text ?? "";
    }
  } else {
    const preset = PRESETS[option ?? "arrow"] ?? PRESETS.arrow;
    hotspot = preset.hotspot;
    shape.innerHTML = `<svg viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${preset.svg}</svg>`;
  }
  Object.assign(shape.style, { width: `${size}px`, height: `${size}px`, transform: `translate(${-hotspot[0]}px, ${-hotspot[1]}px)` });
  return shape;
}
