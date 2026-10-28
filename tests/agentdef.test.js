import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { agentDefinition } from '../src/adapters/claude-code/agentdef.js';

describe('agentDefinition (claude-code)', () => {
  let tmp;
  let ref;
  const meta = async (id, agentType) =>
    writeFile(join(tmp, 'projects', '-p', 'sess', 'subagents', `agent-${id}.meta.json`), JSON.stringify({ agentType }));

  beforeAll(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'rg-agentdef-'));
    await mkdir(join(tmp, 'projects', '-p', 'sess', 'subagents'), { recursive: true });
    await mkdir(join(tmp, 'proj', '.claude', 'agents'), { recursive: true });
    await mkdir(join(tmp, 'home', '.claude', 'agents', 'team'), { recursive: true });
    await mkdir(join(tmp, 'home', '.claude', 'plugins', 'marketplaces', 'm', 'plugins', 'feature-dev', 'agents'), { recursive: true });
    await writeFile(join(tmp, 'proj', '.claude', 'agents', 'game-explorer.md'), '---\nname: game-explorer\n---\nbody');
    await writeFile(join(tmp, 'home', '.claude', 'agents', 'team', 'critic.md'), '---\nname: tone-critic\n---\nbody');
    await writeFile(join(tmp, 'home', '.claude', 'plugins', 'marketplaces', 'm', 'plugins', 'feature-dev', 'agents', 'code-reviewer.md'), 'x');
    await meta('a1', 'game-explorer');
    await meta('a2', 'tone-critic');
    await meta('a3', 'feature-dev:code-reviewer');
    await meta('a4', 'general-purpose');
    await meta('a5', 'nowhere-to-be-found');
    ref = { kind: 'session', projectDir: join(tmp, 'projects', '-p'), sessionId: 'sess', project: join(tmp, 'proj'), projectExists: true };
  });
  afterAll(() => rm(tmp, { recursive: true, force: true }));

  const def = (agentId) => agentDefinition(ref, { kind: 'agent', agentId }, { home: join(tmp, 'home') });

  it('finds a project agent by file name', async () => {
    expect((await def('a1')).file).toBe(join(tmp, 'proj', '.claude', 'agents', 'game-explorer.md'));
  });
  it('finds a user agent by its front-matter name, in a subfolder', async () => {
    expect((await def('a2')).file).toBe(join(tmp, 'home', '.claude', 'agents', 'team', 'critic.md'));
  });
  it('finds a plugin agent from plugin:name', async () => {
    expect((await def('a3')).file).toMatch(/feature-dev\/agents\/code-reviewer\.md$/);
  });
  it('says built in, or not found, instead of guessing', async () => {
    expect(await def('a4')).toEqual({ agentType: 'general-purpose', file: null, builtIn: true });
    expect(await def('a5')).toEqual({ agentType: 'nowhere-to-be-found', file: null, builtIn: false });
    expect(await agentDefinition(ref, { kind: 'agent', agentId: '../x' })).toEqual({ agentType: null, file: null, builtIn: false });
  });
});

import { skillDefinition } from '../src/adapters/claude-code/agentdef.js';
import { attachDefinitions, definitionLine } from '../src/definitions.js';

describe('skillDefinition (claude-code)', () => {
  let tmp;
  let ref;
  beforeAll(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'rg-skilldef-'));
    await mkdir(join(tmp, 'proj', '.claude', 'skills', 'wander'), { recursive: true });
    await writeFile(join(tmp, 'proj', '.claude', 'skills', 'wander', 'SKILL.md'), 'x');
    await mkdir(join(tmp, 'home', '.claude', 'plugins', 'synced', 'abc', 'mattpocock-skills', 'skills', 'tdd'), { recursive: true });
    await writeFile(join(tmp, 'home', '.claude', 'plugins', 'synced', 'abc', 'mattpocock-skills', 'skills', 'tdd', 'SKILL.md'), 'x');
    ref = { project: join(tmp, 'proj'), projectExists: true };
  });
  afterAll(() => rm(tmp, { recursive: true, force: true }));
  const def = (name) => skillDefinition(ref, name, { home: join(tmp, 'home') });

  it('finds a project skill, and a plugin skill by plugin:name in any plugin layout', async () => {
    expect((await def('wander')).file).toBe(join(tmp, 'proj', '.claude', 'skills', 'wander', 'SKILL.md'));
    expect((await def('mattpocock-skills:tdd')).file).toMatch(/mattpocock-skills\/skills\/tdd\/SKILL\.md$/);
  });
  it('a skill with no file on disk (built in) is null, and odd names never become paths', async () => {
    expect((await def('loop')).file).toBe(null);
    expect((await def('../../etc')).file).toBe(null);
  });
});

describe('attachDefinitions / definitionLine', () => {
  it('decorates agent and Skill nodes, and names the file in one line', async () => {
    const adapter = {
      agentDefinition: async (_r, n) => (n.agentId === 'w' ? { agentType: 'writer', file: '/p/.claude/agents/writer.md', builtIn: false } : { agentType: 'general-purpose', file: null, builtIn: true }),
      skillDefinition: async (_r, s) => ({ skill: s, file: s === 'wander' ? '/p/.claude/skills/wander/SKILL.md' : null }),
    };
    const ir = {
      nodes: [
        { id: 'a', kind: 'agent', agentId: 'w', label: 'Write' },
        { id: 'b', kind: 'agent', agentId: 'g', label: 'Look' },
        { id: 'c', kind: 'tool', label: 'Skill · wander' },
        { id: 'd', kind: 'tool', label: 'Bash · ls' },
      ],
    };
    const details = new Map([
      ['a', { kind: 'agent', transcript: [{ role: 'assistant', toolName: 'Skill', text: '{"skill":"loop"}' }] }],
      ['c', { kind: 'tool', calls: [{ input: '{\n  "skill": "wander"\n}' }] }],
    ]);
    await attachDefinitions(adapter, {}, ir, details);
    const [a, b, c, d] = ir.nodes;
    expect(definitionLine(a)).toBe('writer.md');
    expect(a.definitions.skills).toEqual([{ name: 'loop', file: null }]);
    expect(definitionLine(b)).toBe('general-purpose · built in');
    expect(definitionLine(c)).toBe('wander/SKILL.md');
    expect(d.definitions).toBeUndefined();
    expect(definitionLine(d)).toBe(null);
  });
});
