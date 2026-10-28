import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../src/server.js';
import { cap } from '../src/adapters/claude-code/helpers.js';
import { withoutCaps } from '../src/textcap.js';

// ---------------------------------------------------------------------------
// "show full": GET /api/detail/<node>?run=<run>&full=1 returns the detail with
// no text cap; without full=1 the cap (and its "… (N more chars)") stays.
// ---------------------------------------------------------------------------

describe('withoutCaps', () => {
  it('lifts cap() inside its async call tree only', async () => {
    const long = 'x'.repeat(50);
    expect(cap(long, 10)).toBe('x'.repeat(10) + '\n… (40 more chars)');
    const inside = await withoutCaps(async () => {
      await new Promise((r) => setTimeout(r, 1));
      return cap(long, 10);
    });
    expect(inside).toBe(long);
    expect(cap(long, 10)).toContain('more chars');
  });
});

describe('GET /api/detail?full=1', () => {
  const SID = 'cccccccc-3333-4333-8333-cccccccccccc';
  const PROMPT = 'p'.repeat(9000); // over the turn prompt's 8,000-char cap
  let tmp;
  let server;
  const runId = `claude-code:-proj:${SID}`;

  beforeAll(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'rg-full-'));
    const dir = join(tmp, 'projects', '-proj');
    await mkdir(dir, { recursive: true });
    const line = (o) => JSON.stringify({ sessionId: SID, cwd: '/proj', ...o });
    await writeFile(
      join(dir, `${SID}.jsonl`),
      [
        line({ type: 'user', uuid: 'u1', parentUuid: null, timestamp: '2026-08-01T13:00:00.000Z', promptId: 'pr1', message: { role: 'user', content: PROMPT } }),
        line({ type: 'assistant', uuid: 'a1', parentUuid: 'u1', timestamp: '2026-08-01T13:00:01.000Z', requestId: 'r1', message: { id: 'm1', role: 'assistant', model: 'claude-fable-5', content: [{ type: 'text', text: 'done' }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } } }),
      ].join('\n') + '\n',
    );
    process.env.RUNGRAPH_CLAUDE_PROJECTS = join(tmp, 'projects');
    for (const k of ['RUNGRAPH_CODEX_SESSIONS', 'RUNGRAPH_HERMES_HOME', 'RUNGRAPH_OPENCODE_HOME', 'RUNGRAPH_CURSOR_GLOBAL_STORAGE', 'RUNGRAPH_CURSOR_CLI_HOME'])
      process.env[k] = '';
    server = await startServer({ preferredPort: 4800 });
  });
  afterAll(async () => {
    for (const k of ['RUNGRAPH_CLAUDE_PROJECTS', 'RUNGRAPH_CODEX_SESSIONS', 'RUNGRAPH_HERMES_HOME', 'RUNGRAPH_OPENCODE_HOME', 'RUNGRAPH_CURSOR_GLOBAL_STORAGE', 'RUNGRAPH_CURSOR_CLI_HOME'])
      delete process.env[k];
    await server.close();
    await rm(tmp, { recursive: true, force: true });
  });

  const get = async (path) => {
    const r = await fetch(server.url + path);
    return { status: r.status, body: await r.json() };
  };

  it('returns the prompt whole with full=1 and shortened without it', async () => {
    const graph = (await get(`/api/graph/${encodeURIComponent(runId)}`)).body;
    const turn = graph.nodes.find((n) => n.kind === 'turn');
    expect(turn).toBeDefined();
    const base = `/api/detail/${encodeURIComponent(turn.id)}?run=${encodeURIComponent(runId)}`;
    const capped = (await get(base)).body;
    expect(capped.prompt).toBe('p'.repeat(8000) + '\n… (1000 more chars)');
    const full = (await get(base + '&full=1')).body;
    expect(full.prompt).toBe(PROMPT);
    // and the ordinary detail is still capped afterwards (the cache is separate)
    expect((await get(base)).body.prompt).toContain('more chars');
  });

  it('404s an unknown run with full=1', async () => {
    expect((await get(`/api/detail/x?run=nope&full=1`)).status).toBe(404);
  });
});
