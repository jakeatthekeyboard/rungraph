import { describe, expect, it } from 'vitest';
import { prettyText } from '../frontend/src/pretty.js';

describe('prettyText', () => {
  it('re-indents a JSON object or array', () => {
    expect(prettyText('{"a":1,"b":[2,3]}')).toBe('{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}');
    expect(prettyText('  [1,2] ')).toBe('[\n  1,\n  2\n]');
  });
  it('leaves everything else unchanged', () => {
    expect(prettyText('plain text')).toBe('plain text');
    expect(prettyText('{"a": 1')).toBe('{"a": 1');
    expect(prettyText('{"a":1}\n… (40 more chars)')).toBe('{"a":1}\n… (40 more chars)');
    expect(prettyText('{not json}')).toBe('{not json}');
    expect(prettyText('42')).toBe('42');
    expect(prettyText(null)).toBe('');
  });
});
