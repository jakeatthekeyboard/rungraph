import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../src/server.js';

// ---------------------------------------------------------------------------
// POST /api/reveal — the picker's folder button. The opener is injected, so
// no Finder / File Explorer window ever opens under test.
// ---------------------------------------------------------------------------

const REAL_SID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const GONE_SID = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';

describe('POST /api/reveal', () => {
  let tmp;
  let projDir;
  let server;
  const opened = [];
  const revealed = [];
  let openResult = true;
  const runId = (dir, sid) => `claude-code:${dir}:${sid}`;

  const session = (cwd) =>
    JSON.stringify({ type: 'user', cwd, timestamp: '2026-08-01T13:00:00.000Z', message: { content: 'hello' } }) + '\n';

  beforeAll(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'rg-reveal-'));
    projDir = join(tmp, 'proj with space');
    await mkdir(projDir, { recursive: true });
    const root = join(tmp, 'projects');
    await mkdir(join(root, '-proj-with-space'), { recursive: true });
    await writeFile(join(root, '-proj-with-space', `${REAL_SID}.jsonl`), session(projDir));
    await mkdir(join(root, '-home-dev-gone'), { recursive: true });
    await writeFile(join(root, '-home-dev-gone', `${GONE_SID}.jsonl`), session('/home/dev/gone'));

    process.env.RUNGRAPH_CLAUDE_PROJECTS = root;
    process.env.RUNGRAPH_CODEX_SESSIONS = '';
    process.env.RUNGRAPH_HERMES_HOME = '';
    process.env.RUNGRAPH_OPENCODE_HOME = '';
    process.env.RUNGRAPH_CURSOR_GLOBAL_STORAGE = '';
    process.env.RUNGRAPH_CURSOR_CLI_HOME = '';
    server = await startServer({
      preferredPort: 4790,
      openFolder: async (dir) => {
        opened.push(dir);
        return openResult;
      },
      revealFile: async (file) => {
        revealed.push(file);
        return true;
      },
    });
  });
  afterAll(async () => {
    for (const k of [
      'RUNGRAPH_CLAUDE_PROJECTS',
      'RUNGRAPH_CODEX_SESSIONS',
      'RUNGRAPH_HERMES_HOME',
      'RUNGRAPH_OPENCODE_HOME',
      'RUNGRAPH_CURSOR_GLOBAL_STORAGE',
      'RUNGRAPH_CURSOR_CLI_HOME',
    ])
      delete process.env[k];
    await server.close();
    await rm(tmp, { recursive: true, force: true });
  });

  const post = async (body, headers = {}) => {
    const res = await fetch(server.url + '/api/reveal', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  it('opens the project folder the scan holds for the run', async () => {
    const { status, body } = await post({ runId: runId('-proj-with-space', REAL_SID) });
    expect(status).toBe(200);
    expect(body).toEqual({ opened: true });
    expect(opened.at(-1)).toBe(projDir);
  });

  it('reports a failed open as opened: false, not an error', async () => {
    openResult = false;
    const { status, body } = await post({ runId: runId('-proj-with-space', REAL_SID) });
    openResult = true;
    expect(status).toBe(200);
    expect(body).toEqual({ opened: false });
  });

  it('refuses a run whose project folder is gone, and opens nothing', async () => {
    const before = opened.length;
    const { status } = await post({ runId: runId('-home-dev-gone', GONE_SID) });
    expect(status).toBe(400);
    expect(opened.length).toBe(before);
  });

  it('what: transcripts opens the folder holding the session .jsonl', async () => {
    const { status, body } = await post({ runId: runId('-proj-with-space', REAL_SID), what: 'transcripts' });
    expect(status).toBe(200);
    expect(body).toEqual({ opened: true });
    expect(opened.at(-1)).toBe(join(tmp, 'projects', '-proj-with-space'));
  });

  it('what: transcripts works even when the project folder is gone', async () => {
    const { status } = await post({ runId: runId('-home-dev-gone', GONE_SID), what: 'transcripts' });
    expect(status).toBe(200);
    expect(opened.at(-1)).toBe(join(tmp, 'projects', '-home-dev-gone'));
  });

  it('400s an unknown what, and opens nothing', async () => {
    const before = opened.length;
    expect((await post({ runId: runId('-proj-with-space', REAL_SID), what: '/etc' })).status).toBe(400);
    expect(opened.length).toBe(before);
  });

  it("what: node shows the session .jsonl a turn node came from", async () => {
    const graph = await (await fetch(server.url + `/api/graph/${encodeURIComponent(runId('-proj-with-space', REAL_SID))}`)).json();
    const node = graph.nodes.find((n) => n.kind === 'turn');
    const { status, body } = await post({ runId: runId('-proj-with-space', REAL_SID), what: 'node', nodeId: node.id });
    expect(status).toBe(200);
    expect(body.opened).toBe(true);
    expect(revealed.at(-1)).toBe(join(tmp, 'projects', '-proj-with-space', `${REAL_SID}.jsonl`));
  });

  it('what: node needs a nodeId and a node that exists', async () => {
    const before = revealed.length;
    expect((await post({ runId: runId('-proj-with-space', REAL_SID), what: 'node' })).status).toBe(400);
    expect((await post({ runId: runId('-proj-with-space', REAL_SID), what: 'node', nodeId: 'nope' })).status).toBe(404);
    expect(revealed.length).toBe(before);
  });

  it('404s an unknown run and 400s a missing runId', async () => {
    expect((await post({ runId: 'claude-code:nope:nope' })).status).toBe(404);
    expect((await post({ path: projDir })).status).toBe(400);
  });

  it('rejects a cross-origin request and a GET', async () => {
    const before = opened.length;
    const x = await post({ runId: runId('-proj-with-space', REAL_SID) }, { origin: 'https://evil.example' });
    expect(x.status).toBe(403);
    expect((await fetch(server.url + '/api/reveal')).status).toBe(405);
    expect(opened.length).toBe(before);
  });
});
