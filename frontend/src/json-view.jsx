// JSON as an indented tree for reading, not a re-serialisation. Every member
// is its own block at its depth, so a long value wraps under its own key
// instead of back to the left edge, and a string's line breaks are real line
// breaks (shown pre-wrap) instead of "\n" escapes — a 3,000-character agent
// prompt reads as the prompt. Copy and "copy JSON" keep the exact text; this
// only changes what is drawn.

/** Parse text that is wholly a JSON object or array; undefined otherwise. */
export function parseJsonBlock(text) {
  const t = typeof text === 'string' ? text.trim() : '';
  if (!(t.startsWith('{') && t.endsWith('}')) && !(t.startsWith('[') && t.endsWith(']'))) return undefined;
  try {
    return JSON.parse(t);
  } catch {
    return undefined;
  }
}

export function JsonView({ value }) {
  return (
    <div class="jv">
      <Value value={value} last />
    </div>
  );
}

function Value({ value, label, last }) {
  const comma = last ? '' : ',';
  const key = label != null && <span class="jv-key">{JSON.stringify(label)}: </span>;
  if (Array.isArray(value) || (value && typeof value === 'object')) {
    const isArr = Array.isArray(value);
    const entries = isArr ? value.map((v, i) => [i, v]) : Object.entries(value);
    const [open, close] = isArr ? ['[', ']'] : ['{', '}'];
    if (!entries.length)
      return (
        <div class="jv-row">
          {key}
          <span class="jv-p">{open + close}</span>
          {comma}
        </div>
      );
    return (
      <div class="jv-row">
        {key}
        <span class="jv-p">{open}</span>
        <div class="jv-in">
          {entries.map(([k, v], i) => (
            <Value key={k} value={v} label={isArr ? null : k} last={i === entries.length - 1} />
          ))}
        </div>
        <span class="jv-p">{close}</span>
        {comma}
      </div>
    );
  }
  if (typeof value === 'string') {
    // Multi-line strings drop to their own block under the key, indented, so
    // every line of the text starts at the same column.
    if (value.includes('\n'))
      return (
        <div class="jv-row">
          {key}
          <span class="jv-q">"</span>
          <div class="jv-str jv-multi">{value}</div>
          <span class="jv-q">"</span>
          {comma}
        </div>
      );
    return (
      <div class="jv-row">
        {key}
        <span class="jv-str">"{value}"</span>
        {comma}
      </div>
    );
  }
  const cls = value === null ? 'jv-null' : typeof value === 'number' ? 'jv-num' : 'jv-bool';
  return (
    <div class="jv-row">
      {key}
      <span class={cls}>{String(value)}</span>
      {comma}
    </div>
  );
}

/** The tree's look, as a string: for the dashboard (styles.css carries the
 *  same rules) and for a break-out window, which has no stylesheet of its own. */
export const JSON_VIEW_CSS = `
  .jv { font-family: var(--mono, ui-monospace, "SF Mono", Menlo, Consolas, monospace); line-height: 1.5; overflow-wrap: anywhere; }
  .jv-row { padding-left: 2ch; text-indent: -2ch; }
  .jv-row > * { text-indent: 0; }
  .jv-in { padding-left: 0; margin-left: 2ch; border-left: 1px solid var(--hairline-soft, #282c34); padding-left: 1ch; }
  .jv-key { color: var(--ink-dim, #a6adbb); }
  .jv-str { color: var(--sage, #8fbf9a); }
  .jv-multi { white-space: pre-wrap; margin: 2px 0 2px 2ch; padding-left: 1ch; border-left: 2px solid color-mix(in srgb, var(--sage, #8fbf9a) 35%, transparent); }
  .jv-num { color: var(--amber, #d8a657); }
  .jv-bool, .jv-null { color: var(--clay, #d0826b); }
  .jv-p, .jv-q { color: var(--ink-faint, #6b7280); }
`;

// One source for the rules: injected once into the dashboard's own document.
if (typeof document !== 'undefined' && !document.getElementById('rungraph-json-view-css')) {
  const el = document.createElement('style');
  el.id = 'rungraph-json-view-css';
  el.textContent = JSON_VIEW_CSS;
  document.head.appendChild(el);
}
