// Colour theme: dark by default, light on request, remembered per browser.
// Storage can throw (private mode, blocked site data); the default still renders.

const KEY = 'rungraph.theme';

export function storedTheme() {
  try {
    return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}

export function setTheme(theme) {
  applyTheme(theme);
  try {
    localStorage.setItem(KEY, theme);
  } catch {}
}

// Text size: one of FONT_SIZES, each a full type palette in styles.css
// (:root[data-font=…]). Small is the original sizing and the default.

const FONT_KEY = 'rungraph.fontSize';

export const FONT_SIZES = [
  { id: 'small', label: 'Sm', title: 'small font · 13px' },
  { id: 'medium', label: 'Md', title: 'medium font · 14.5px' },
  { id: 'large', label: 'Lg', title: 'large font · 16px' },
];

export function storedFontSize() {
  try {
    const v = localStorage.getItem(FONT_KEY);
    return FONT_SIZES.some((f) => f.id === v) ? v : 'small';
  } catch {
    return 'small';
  }
}

export function applyFontSize(size) {
  document.documentElement.dataset.font = size;
}

export function setFontSize(size) {
  applyFontSize(size);
  try {
    localStorage.setItem(FONT_KEY, size);
  } catch {}
}
