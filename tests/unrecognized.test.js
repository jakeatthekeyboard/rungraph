import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../src/server.js';
import { skeleton } from '../src/adapters/claude-code/diagnose.js';

describe('skeleton', () => {
  it('keeps keys and types, replaces values, keeps type/subtype names', () => {
    expect(skeleton({ type: 'brand-new', subtype: 'x', secret: 'hunter2', n: 3, ok: true, list: [{ a: 'b' }, 1, 2], nil: null })).toEqual({
      type: 'brand-new',
      subtype: 'x',
      secret: '<string 7>',
      n: '<number>',
      ok: '<boolean>',
      list: [{ a: '<string 1>' }, '…2 more'],
      nil: null,
    });
  });
  it('never carries a type value that is not an identifier', () => {
    expect(skeleton({ type: 'has spaces and more' }).type).toBe('<string 19>');
  });
});

describe('GET /api/unrecognized/<run>', () => {
  const SID = 'dddddddd-4444-4444-8444-dddddddddddd';
  let tmp;
  let server;
  const runId = `claude-code:-proj:${SID}`;

  beforeAll(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'rg-unrec-'));
    const dir = join(tmp, 'projects', '-proj');
    await mkdir(dir, { recursive: true });
    const line = (o) => JSON.stringify({ sessionId: SID, cwd: '/proj', ...o });
    await writeFile(
      join(dir, `${SID}.jsonl`),
      [
        line({ type: 'user', uuid: 'u1', parentUuid: null, timestamp: '2026-08-01T13:00:00.000Z', promptId: 'p1', message: { role: 'user', content: 'hello' } }),
        line({ type: 'shiny-new-record', payload: { secret: 'do not leak' } }),
        line({ type: 'shiny-new-record', payload: { secret: 'nor this' } }),
        '{not json',
        line({ type: 'assistant', uuid: 'a1', parentUuid: 'u1', timestamp: '2026-08-01T13:00:01.000Z', requestId: 'r1', message: { id: 'm1', role: 'assistant', model: 'claude-fable-5', content: [{ type: 'text', text: 'hi' }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } } }),
      ].join('\n') + '\n',
    );
    process.env.RUNGRAPH_CLAUDE_PROJECTS = join(tmp, 'projects');
    for (const k of ['RUNGRAPH_CODEX_SESSIONS', 'RUNGRAPH_HERMES_HOME', 'RUNGRAPH_OPENCODE_HOME', 'RUNGRAPH_CURSOR_GLOBAL_STORAGE', 'RUNGRAPH_CURSOR_CLI_HOME'])
      process.env[k] = '';
    server = await startServer({ preferredPort: 4810 });
  });
  afterAll(async () => {
    for (const k of ['RUNGRAPH_CLAUDE_PROJECTS', 'RUNGRAPH_CODEX_SESSIONS', 'RUNGRAPH_HERMES_HOME', 'RUNGRAPH_OPENCODE_HOME', 'RUNGRAPH_CURSOR_GLOBAL_STORAGE', 'RUNGRAPH_CURSOR_CLI_HOME'])
      delete process.env[k];
    await server.close();
    await rm(tmp, { recursive: true, force: true });
  });

  it('groups skipped records with their shape and location, without their values', async () => {
    const r = await fetch(`${server.url}/api/unrecognized/${encodeURIComponent(runId)}`);
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.total).toBe(3);
    const g = body.groups.find((x) => x.type === 'shiny-new-record');
    expect(g.count).toBe(2);
    expect(g.samples[0].line).toBe(2);
    expect(g.samples[0].shape).toEqual({ sessionId: '<string 36>', cwd: '<string 5>', type: 'shiny-new-record', payload: { secret: '<string 11>' } });
    expect(body.groups.find((x) => x.type === '(invalid JSON)').count).toBe(1);
    expect(body.text).toContain('## `shiny-new-record` ×2');
    expect(body.text).not.toContain('do not leak');
    // the report agrees with the graph's own count
    const graph = await (await fetch(`${server.url}/api/graph/${encodeURIComponent(runId)}`)).json();
    expect(graph.meta.unrecognizedLineCount).toBe(body.total);
  });

  it('404s an unknown run', async () => {
    expect((await fetch(`${server.url}/api/unrecognized/nope`)).status).toBe(404);
  });
});
