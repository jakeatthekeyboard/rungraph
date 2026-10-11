// The right panel's (inspector's) width, when the user has dragged it.
//
// The default lives in styles.css (`--inspector-w: min(384px, 30vw)`). A drag
// sets `--inspector-w` to a px value on <html>, which overrides that default
// everywhere the variable is read, and remembers it in localStorage. Storage
// is a convenience: if it is unavailable, resizing still works for the page.

const KEY = 'rungraph.inspectorWidth';

export const MIN_W = 260;
const MIN_CANVAS = 240; // never squeeze the graph below this

/** The width the CSS default resolves to. Kept equal to styles.css. */
export function defaultInspectorWidth() {
  return Math.min(384, window.innerWidth * 0.3);
}

/** Largest width that still leaves the picker and some graph visible. */
export function maxInspectorWidth() {
  const picker = document.querySelector('.picker')?.getBoundingClientRect().width ?? 0;
  return Math.max(MIN_W, window.innerWidth - picker - MIN_CANVAS);
}

export function clampInspectorWidth(w) {
  return Math.round(Math.min(maxInspectorWidth(), Math.max(MIN_W, w)));
}

/** The width the user dragged to, as set on <html> ('' when never dragged). */
export function inspectorWidthSetting() {
  return document.documentElement.style.getPropertyValue('--inspector-w');
}

/** The panel's current width in px: the dragged width, or the default. */
export function inspectorWidth() {
  const set = parseFloat(document.documentElement.style.getPropertyValue('--inspector-w'));
  return Number.isFinite(set) ? set : defaultInspectorWidth();
}

/** Apply a width (null = back to the default) and remember it. */
export function setInspectorWidth(w) {
  const root = document.documentElement.style;
  if (w == null) {
    root.removeProperty('--inspector-w');
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* storage unavailable */
    }
    return;
  }
  const px = clampInspectorWidth(w);
  root.setProperty('--inspector-w', `${px}px`);
  try {
    localStorage.setItem(KEY, String(px));
  } catch {
    /* storage unavailable */
  }
}

/** Restore a remembered width once, at startup. */
export function restoreInspectorWidth() {
  try {
    const w = parseFloat(localStorage.getItem(KEY) ?? '');
    if (Number.isFinite(w) && w >= MIN_W) {
      document.documentElement.style.setProperty('--inspector-w', `${Math.round(w)}px`);
    }
  } catch {
    /* storage unavailable */
  }
}
