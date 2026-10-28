// A small Markdown reader for the inspector's "style" mode. It produces a
// plain tree of blocks and inline runs — never an HTML string — so whatever
// a transcript contains is shown as text, not run. Covers what agents write:
// headings, paragraphs, fenced code, lists (nested by indent), blockquotes,
// tables, rules, and inline code / bold / italic / strike / links.

/** Whether text reads as Markdown rather than plain output. */
export function looksLikeMarkdown(text) {
  if (typeof text !== 'string' || text.length < 3) return false;
  const lines = text.split('\n');
  if (lines.some((l) => /^#{1,6}\s+\S/.test(l))) return true;
  if (lines.some((l) => /^\s*(```|~~~)/.test(l))) return true;
  if (lines.filter((l) => /^\s*([-*+]|\d+[.)])\s+\S/.test(l)).length >= 2) return true;
  if (lines.some((l, i) => /\|/.test(l) && i + 1 < lines.length && isTableSep(lines[i + 1]))) return true;
  if (lines.filter((l) => /^>\s?/.test(l)).length >= 1 && lines.length > 1) return true;
  const inline =
    (text.match(/\*\*[^*\n]+\*\*/g)?.length ?? 0) +
    (text.match(/\[[^\]\n]+\]\(https?:\/\/[^)\s]+\)/g)?.length ?? 0) +
    (text.match(/`[^`\n]+`/g)?.length ?? 0);
  return inline >= 2;
}

const isTableSep = (l) => /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(l) && l.includes('|');
const splitRow = (l) =>
  l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
const LIST = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;

/** Text → blocks: { type, … } with inline content as parseInline() runs. */
export function parseMarkdown(text) {
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const fence = /^\s*(```|~~~)\s*([\w+-]*)/.exec(line);
    if (fence) {
      const body = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence[1])) body.push(lines[i++]);
      i++; // closing fence (or end of text)
      blocks.push({ type: 'code', lang: fence[2] || null, text: body.join('\n') });
      continue;
    }
    const h = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (h) {
      blocks.push({ type: 'heading', level: h[1].length, content: parseInline(h[2]) });
      i++;
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      blocks.push({ type: 'rule' });
      i++;
      continue;
    }
    if (/\|/.test(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const head = splitRow(line).map(parseInline);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim() && /\|/.test(lines[i])) rows.push(splitRow(lines[i++]).map(parseInline));
      blocks.push({ type: 'table', head, rows });
      continue;
    }
    if (/^>\s?/.test(line)) {
      const body = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) body.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push({ type: 'quote', blocks: parseMarkdown(body.join('\n')) });
      continue;
    }
    if (LIST.test(line)) {
      const items = [];
      while (i < lines.length) {
        const m = LIST.exec(lines[i]);
        if (m) {
          items.push({ indent: m[1].replace(/\t/g, '  ').length, ordered: /\d/.test(m[2]), text: m[3] });
          i++;
        } else if (lines[i].trim() && /^\s{2,}\S/.test(lines[i]) && items.length) {
          items[items.length - 1].text += ' ' + lines[i].trim(); // wrapped item line
          i++;
        } else break;
      }
      blocks.push(nestList(items));
      continue;
    }
    const para = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*(```|~~~)/.test(lines[i]) &&
      !/^#{1,6}\s+/.test(lines[i]) &&
      !/^>\s?/.test(lines[i]) &&
      !LIST.test(lines[i])
    )
      para.push(lines[i++]);
    blocks.push({ type: 'paragraph', content: parseInline(para.join('\n')) });
  }
  return blocks;
}

/** Flat items with indents → a list whose items may hold a nested list. */
function nestList(items) {
  const root = { type: 'list', ordered: items[0].ordered, items: [] };
  const stack = [{ indent: items[0].indent, list: root }];
  for (const it of items) {
    while (stack.length > 1 && it.indent < stack[stack.length - 1].indent) stack.pop();
    let top = stack[stack.length - 1];
    if (it.indent > top.indent && top.list.items.length) {
      const parent = top.list.items[top.list.items.length - 1];
      parent.sub = { type: 'list', ordered: it.ordered, items: [] };
      stack.push({ indent: it.indent, list: parent.sub });
      top = stack[stack.length - 1];
    }
    top.list.items.push({ content: parseInline(it.text) });
  }
  return root;
}

const INLINE =
  /(`+)([^`]|[^`][\s\S]*?[^`])\1|\*\*([^*]+?)\*\*|__([^_]+?)__|~~([^~]+?)~~|\*([^*\s][^*]*?)\*|(?<![\w])_([^_\s][^_]*?)_(?![\w])|\[([^\]]+)\]\((\S+?)\)|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/;

/** Inline text → runs: strings and { type: code|strong|em|del|link, … }. */
export function parseInline(text) {
  const out = [];
  let rest = String(text ?? '');
  while (rest) {
    const m = INLINE.exec(rest);
    if (!m) {
      out.push(rest);
      break;
    }
    if (m.index) out.push(rest.slice(0, m.index));
    if (m[1]) out.push({ type: 'code', text: m[2].trim() || m[2] });
    else if (m[3] != null || m[4] != null) out.push({ type: 'strong', content: parseInline(m[3] ?? m[4]) });
    else if (m[5] != null) out.push({ type: 'del', content: parseInline(m[5]) });
    else if (m[6] != null || m[7] != null) out.push({ type: 'em', content: parseInline(m[6] ?? m[7]) });
    else if (m[8] != null) out.push({ type: 'link', href: safeHref(m[9]), content: parseInline(m[8]) });
    else if (m[10] != null) out.push({ type: 'link', href: safeHref(m[10]), content: [m[10]] });
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

/** Only http(s) links are followable; anything else renders as text. */
export function safeHref(url) {
  return /^https?:\/\//i.test(url) ? url : null;
}
