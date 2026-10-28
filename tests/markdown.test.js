import { describe, expect, it } from 'vitest';
import { looksLikeMarkdown, parseMarkdown, parseInline, safeHref } from '../frontend/src/markdown.js';

describe('looksLikeMarkdown', () => {
  it('spots the block shapes agents write', () => {
    expect(looksLikeMarkdown('## Summary\nDone.')).toBe(true);
    expect(looksLikeMarkdown('Run:\n```sh\nnpm test\n```')).toBe(true);
    expect(looksLikeMarkdown('- one\n- two')).toBe(true);
    expect(looksLikeMarkdown('| a | b |\n|---|---|\n| 1 | 2 |')).toBe(true);
    expect(looksLikeMarkdown('Use **bold** and `code`.')).toBe(true);
  });
  it('leaves plain output alone', () => {
    expect(looksLikeMarkdown('/Users/jake/dev/certopolis  354b8124 [master]')).toBe(false);
    expect(looksLikeMarkdown('fix')).toBe(false);
    expect(looksLikeMarkdown('- just one dash line')).toBe(false);
    expect(looksLikeMarkdown('a * b * c')).toBe(false);
  });
});

describe('parseMarkdown', () => {
  it('reads headings, paragraphs, code, rules and quotes', () => {
    const b = parseMarkdown('# Title\n\nSome text\nmore\n\n```js\nx = 1\n```\n---\n> quoted');
    expect(b.map((x) => x.type)).toEqual(['heading', 'paragraph', 'code', 'rule', 'quote']);
    expect(b[0].level).toBe(1);
    expect(b[2]).toEqual({ type: 'code', lang: 'js', text: 'x = 1' });
  });
  it('nests lists by indent and keeps ordered-ness', () => {
    const [list] = parseMarkdown('1. a\n2. b\n   - c\n3. d');
    expect(list.ordered).toBe(true);
    expect(list.items).toHaveLength(3);
    expect(list.items[1].sub.items[0].content).toEqual(['c']);
  });
  it('reads a table', () => {
    const [t] = parseMarkdown('| a | b |\n| --- | :-: |\n| 1 | **2** |');
    expect(t.type).toBe('table');
    expect(t.head).toEqual([['a'], ['b']]);
    expect(t.rows[0][1]).toEqual([{ type: 'strong', content: ['2'] }]);
  });
  it('an unclosed fence runs to the end instead of throwing', () => {
    expect(parseMarkdown('```\nopen').at(-1)).toEqual({ type: 'code', lang: null, text: 'open' });
  });
});

describe('parseInline', () => {
  it('reads code, bold, italic, strike and links', () => {
    expect(parseInline('a `x*y` **b** *c* ~~d~~ [e](https://x.io)')).toEqual([
      'a ',
      { type: 'code', text: 'x*y' },
      ' ',
      { type: 'strong', content: ['b'] },
      ' ',
      { type: 'em', content: ['c'] },
      ' ',
      { type: 'del', content: ['d'] },
      ' ',
      { type: 'link', href: 'https://x.io', content: ['e'] },
    ]);
  });
  it('never makes a non-http link followable', () => {
    expect(parseInline('[x](javascript:alert(1))')[0].href).toBe(null);
    expect(safeHref('file:///etc/passwd')).toBe(null);
    expect(safeHref('https://a.b')).toBe('https://a.b');
  });
  it('leaves snake_case words alone', () => {
    expect(parseInline('some_var_name here')).toEqual(['some_var_name here']);
  });
});
