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

// ---- the left panel (picker) ------------------------------------------------
//
// Same scheme as the inspector. The default lives in styles.css
// (`--picker-w: min(var(--picker-max), max(208px, 28vw))`); a drag sets
// `--picker-w-set` on <html>, which `.main` prefers over that default. A
// collapsed picker still goes to 0 whatever was dragged.

const PICKER_KEY = 'rungraph.pickerWidth';

export const PICKER_MIN_W = 208; // the CSS floor: narrower and labels stop reading

/** The width the CSS default resolves to (the picker as rendered, when open). */
function defaultPickerWidth() {
  return document.querySelector('.picker')?.getBoundingClientRect().width ?? PICKER_MIN_W;
}

/** Largest width that still leaves the inspector and some graph visible. */
export function maxPickerWidth() {
  const inspector = document.querySelector('.inspector')?.getBoundingClientRect().width ?? 0;
  return Math.max(PICKER_MIN_W, window.innerWidth - inspector - MIN_CANVAS);
}

export function clampPickerWidth(w) {
  return Math.round(Math.min(maxPickerWidth(), Math.max(PICKER_MIN_W, w)));
}

/** The width the user dragged to, as set on <html> ('' when never dragged). */
export function pickerWidthSetting() {
  return document.documentElement.style.getPropertyValue('--picker-w-set');
}

/** The picker's current width in px: the dragged width, or the default. */
export function pickerWidth() {
  const set = parseFloat(pickerWidthSetting());
  return Number.isFinite(set) ? set : defaultPickerWidth();
}

/** Apply a width (null = back to the default) and remember it. */
export function setPickerWidth(w) {
  const root = document.documentElement.style;
  if (w == null) {
    root.removeProperty('--picker-w-set');
    try {
      localStorage.removeItem(PICKER_KEY);
    } catch {
      /* storage unavailable */
    }
    return;
  }
  const px = clampPickerWidth(w);
  root.setProperty('--picker-w-set', `${px}px`);
  try {
    localStorage.setItem(PICKER_KEY, String(px));
  } catch {
    /* storage unavailable */
  }
}

/** Restore a remembered width once, at startup. */
export function restorePickerWidth() {
  try {
    const w = parseFloat(localStorage.getItem(PICKER_KEY) ?? '');
    if (Number.isFinite(w) && w >= PICKER_MIN_W) {
      document.documentElement.style.setProperty('--picker-w-set', `${Math.round(w)}px`);
    }
  } catch {
    /* storage unavailable */
  }
}
