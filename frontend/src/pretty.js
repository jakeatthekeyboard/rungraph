// Text shown in a break-out window. When the whole text is JSON (an object or
// an array), it is re-indented two spaces so a one-line tool payload reads as
// a tree. Anything else, including JSON the adapter shortened (its
// "… (N more chars)" tail makes it invalid), comes back unchanged.

export function prettyText(text) {
  const s = String(text ?? '');
  const t = s.trim();
  if (!(t.startsWith('{') && t.endsWith('}')) && !(t.startsWith('[') && t.endsWith(']'))) return s;
  try {
    return JSON.stringify(JSON.parse(t), null, 2);
  } catch {
    return s;
  }
}
