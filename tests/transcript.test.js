import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startServer } from '../src/server.js';
import { pinFixtureMtimes, FIXTURE_ROOT, CODEX_FIXTURE_ROOT, SESSION_RUN_ID, WORKFLOW_RUN_ID, CODEX_CLEAN_RUN_ID } from './helpers.js';

// GET /api/transcript/<run> — the "full transcript" window's data.

describe('GET /api/transcript/<run>', () => {
  let server;
  const ENV = ['RUNGRAPH_CLAUDE_PROJECTS', 'RUNGRAPH_CODEX_SESSIONS', 'RUNGRAPH_HERMES_HOME', 'RUNGRAPH_OPENCODE_HOME', 'RUNGRAPH_CURSOR_GLOBAL_STORAGE', 'RUNGRAPH_CURSOR_CLI_HOME'];
  beforeAll(async () => {
    await pinFixtureMtimes();
    process.env.RUNGRAPH_CLAUDE_PROJECTS = FIXTURE_ROOT;
    process.env.RUNGRAPH_CODEX_SESSIONS = CODEX_FIXTURE_ROOT;
    for (const k of ENV.slice(2)) process.env[k] = '';
    server = await startServer({ preferredPort: 4820 });
  });
  afterAll(async () => {
    for (const k of ENV) delete process.env[k];
    await server.close();
  });
  const get = async (id) => {
    const r = await fetch(`${server.url}/api/transcript/${encodeURIComponent(id)}`);
    return { status: r.status, body: await r.json() };
  };

  it('reads a Claude Code session in file order: prompts, replies, tool calls with results', async () => {
    const { status, body } = await get(SESSION_RUN_ID);
    expect(status).toBe(200);
    expect(body.source).toBe('transcript');
    const roles = body.entries.map((e) => e.role);
    expect(roles[0]).toBe('user');
    expect(roles).toContain('assistant');
    const calls = body.entries.filter((e) => e.role === 'tool');
    expect(calls.length).toBeGreaterThan(0);
    // every call the session answered carries its result
    expect(calls.filter((c) => c.output != null).length).toBeGreaterThan(0);
    expect(body.entries.find((e) => e.role === 'user').text).toContain('login');
  });

  it('a workflow run and other adapters are rebuilt from the graph', async () => {
    const wf = await get(WORKFLOW_RUN_ID);
    expect(wf.status).toBe(200);
    expect(wf.body.source).toBe('graph');
    expect(wf.body.entries.some((e) => e.agent)).toBe(true);
    const codex = await get(CODEX_CLEAN_RUN_ID);
    expect(codex.status).toBe(200);
    expect(codex.body.source).toBe('graph');
    expect(codex.body.entries.some((e) => e.role === 'user')).toBe(true);
  });

  it("an agent node's detail names its transcript file, relative to the project folder", async () => {
    const graph = await (await fetch(`${server.url}/api/graph/${encodeURIComponent(SESSION_RUN_ID)}`)).json();
    const agent = graph.nodes.find((n) => n.kind === 'agent');
    const d = await (await fetch(`${server.url}/api/detail/${encodeURIComponent(agent.id)}?run=${encodeURIComponent(SESSION_RUN_ID)}`)).json();
    expect(d.source.name).toMatch(/\.jsonl$/);
    expect(d.source.path.startsWith('/')).toBe(false);
    expect(d.source.path.endsWith(d.source.name)).toBe(true);
    const turn = graph.nodes.find((n) => n.kind === 'turn');
    const t = await (await fetch(`${server.url}/api/detail/${encodeURIComponent(turn.id)}?run=${encodeURIComponent(SESSION_RUN_ID)}`)).json();
    expect(t.source).toBeUndefined();
  });

  it('404s an unknown run', async () => {
    expect((await get('nope')).status).toBe(404);
  });
});
