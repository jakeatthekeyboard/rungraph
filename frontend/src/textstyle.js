// The header's "style" switch: when on, the inspector's text boxes render
// Markdown and pretty-print complete JSON. Off by default; remembered per
// browser (storage can throw — the default still works). A tiny store so the
// header and every text box agree without threading a prop through the pane.

import { useEffect, useState } from 'preact/hooks';

const KEY = 'rungraph.styleText';
const listeners = new Set();

function read() {
  try {
    return localStorage.getItem(KEY) === 'on';
  } catch {
    return false;
  }
}

let on = typeof window === 'undefined' ? false : read();

export function textStyleOn() {
  return on;
}

export function setTextStyle(next) {
  on = Boolean(next);
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {}
  for (const fn of listeners) fn(on);
}

/** The current switch, re-rendering the caller when it flips. */
export function useTextStyle() {
  const [value, setValue] = useState(on);
  useEffect(() => {
    listeners.add(setValue);
    setValue(on);
    return () => listeners.delete(setValue);
  }, []);
  return value;
}
