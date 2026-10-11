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
