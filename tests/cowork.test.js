import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detect, resumeInfo } from '../src/adapters/claude-code/detect.js';
import { defaultRootDirs } from '../src/scanner.js';

// Claude desktop's Cowork mode keeps ordinary Claude Code transcripts at
// local-agent-mode-sessions/<account>/<org>/local_<id>/.claude/projects/,
// with the app's display title in a local_<id>.json sidecar.
const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, 'fixtures', 'projects', '-home-dev-acme', '33333333-3333-4333-8333-333333333333.jsonl');

let tmp;
let store;
beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), 'rungraph-cowork-'));
  store = join(tmp, 'local-agent-mode-sessions');
  const org = join(store, 'acct', 'org');
  const projects = join(org, 'local_abc', '.claude', 'projects', '-sessions-calm-turing');
  mkdirSync(projects, { recursive: true });
  copyFileSync(SRC, join(projects, '33333333-3333-4333-8333-333333333333.jsonl'));
  writeFileSync(join(org, 'local_abc.json'), JSON.stringify({ title: 'Weekly vendor report' }));
  // A session with no transcript yet, and a stray file: both ignored.
  mkdirSync(join(org, 'local_empty'), { recursive: true });
  writeFileSync(join(org, 'cowork-clientdata-cache.json'), '{}');
});
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe('Cowork sessions', () => {
  it('finds transcripts under the store and titles them from the sidecar', async () => {
    const refs = await detect([store]);
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({
      runId: 'claude-code:-sessions-calm-turing:33333333-3333-4333-8333-333333333333',
      adapter: 'claude-code',
      kind: 'session',
      title: 'Weekly vendor report',
      cowork: true,
    });
  });

  it('offers no resume command (the session lives in the desktop app)', async () => {
    const [ref] = await detect([store]);
    expect(resumeInfo(ref)).toBeNull();
  });
});

describe('Cowork scan roots', () => {
  const saved = { ...process.env };
  afterEach(() => {
    for (const k of ['RUNGRAPH_CLAUDE_PROJECTS', 'RUNGRAPH_CLAUDE_COWORK']) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('scans the desktop store by default', () => {
    delete process.env.RUNGRAPH_CLAUDE_PROJECTS;
    delete process.env.RUNGRAPH_CLAUDE_COWORK;
    const roots = defaultRootDirs()['claude-code'];
    expect(roots.some((r) => r.endsWith('local-agent-mode-sessions'))).toBe(true);
  });

  it('drops the store when the Claude root is overridden (keeps tests off the real corpus)', () => {
    process.env.RUNGRAPH_CLAUDE_PROJECTS = '/fixtures';
    delete process.env.RUNGRAPH_CLAUDE_COWORK;
    expect(defaultRootDirs()['claude-code']).toEqual(['/fixtures']);
  });

  it('honours RUNGRAPH_CLAUDE_COWORK, and empty disables it', () => {
    process.env.RUNGRAPH_CLAUDE_PROJECTS = '';
    process.env.RUNGRAPH_CLAUDE_COWORK = '/x/local-agent-mode-sessions';
    expect(defaultRootDirs()['claude-code']).toEqual(['/x/local-agent-mode-sessions']);
    delete process.env.RUNGRAPH_CLAUDE_PROJECTS;
    process.env.RUNGRAPH_CLAUDE_COWORK = '';
    expect(defaultRootDirs()['claude-code']).toHaveLength(1);
  });
});
