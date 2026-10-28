import { readdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { statOrNull } from '../../util.js';

// Which agent definition an agent node ran as, and where its .md file is.
// The type comes from the agent's agent-<id>.meta.json (`agentType`). The
// file is looked for where Claude Code loads agents from: the project's
// .claude/agents, ~/.claude/agents, then installed plugins' agents folders
// (plugin agents are typed `plugin:name`). Built-in types have no file.

const BUILT_IN = new Set(['general-purpose', 'Explore', 'Plan', 'statusline-setup', 'claude-code-guide', 'output-style-setup', 'fork', 'workflow-subagent']);

async function agentType(ref, node) {
  if (typeof node?.agentId !== 'string' || !/^[\w-]+$/.test(node.agentId)) return null;
  const dir = ref.kind === 'workflow' ? ref.wfDir : join(ref.projectDir, ref.sessionId, 'subagents');
  try {
    const meta = JSON.parse(await readFile(join(dir, `agent-${node.agentId}.meta.json`), 'utf8'));
    return typeof meta?.agentType === 'string' ? meta.agentType : null;
  } catch {
    return null;
  }
}

/** Every .md under dir (a couple of levels deep — agents may be grouped in folders). */
async function mdFiles(dir, depth = 0) {
  let ents = [];
  try {
    ents = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const e of ents) {
    const p = join(dir, e.name);
    if (e.isFile() && e.name.endsWith('.md')) out.push(p);
    else if (e.isDirectory() && depth < 2) out.push(...(await mdFiles(p, depth + 1)));
  }
  return out;
}

/**
 * Every agent .md and SKILL.md under the plugins folder, whatever its layout
 * (marketplaces/…/plugins/<p>/, cache/<m>/<p>/<ver>/, synced/…/<p>/). One
 * bounded walk, remembered for a short while: a run with a hundred agents
 * must not walk the tree a hundred times.
 */
const pluginWalk = new Map(); // root → { at, agents: string[], skills: string[] }
async function pluginDefinitionFiles(root) {
  const hit = pluginWalk.get(root);
  if (hit && Date.now() - hit.at < 30_000) return hit;
  const agents = [];
  const skills = [];
  const walk = async (dir, depth) => {
    let ents = [];
    try {
      ents = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of ents) {
      if (!e.isDirectory() || e.name.startsWith('.') || e.name === 'node_modules') continue;
      const p = join(dir, e.name);
      if (e.name === 'agents') agents.push(...(await mdFiles(p)));
      else if (e.name === 'skills') {
        for (const s of await readdir(p, { withFileTypes: true }).catch(() => [])) {
          if (s.isDirectory() && (await statOrNull(join(p, s.name, 'SKILL.md')))) skills.push(join(p, s.name, 'SKILL.md'));
        }
      } else if (depth < 6) await walk(p, depth + 1);
    }
  };
  await walk(root, 0);
  const out = { at: Date.now(), agents, skills };
  pluginWalk.set(root, out);
  return out;
}

/** The front matter's `name:`, when the file has one. */
async function declaredName(file) {
  try {
    const head = (await readFile(file, 'utf8')).slice(0, 2000);
    const m = /^---\s*\n([\s\S]*?)\n---/.exec(head);
    const n = m && /^name:\s*["']?([^"'\n]+?)["']?\s*$/m.exec(m[1]);
    return n ? n[1].trim() : null;
  } catch {
    return null;
  }
}

async function findIn(dirs, name) {
  const want = name.toLowerCase();
  for (const dir of dirs) {
    if (!(await statOrNull(dir))) continue;
    const files = await mdFiles(dir);
    const byFile = files.find((f) => basename(f, '.md').toLowerCase() === want);
    if (byFile) return byFile;
    for (const f of files) if ((await declaredName(f))?.toLowerCase() === want) return f;
  }
  return null;
}

/**
 * @returns {Promise<{ agentType: string|null, file: string|null, builtIn: boolean }>}
 */
export async function agentDefinition(ref, node, { home = homedir() } = {}) {
  const type = await agentType(ref, node);
  if (!type) return { agentType: null, file: null, builtIn: false };
  if (BUILT_IN.has(type)) return { agentType: type, file: null, builtIn: true };
  const [plugin, name] = type.includes(':') ? type.split(/:(.*)/s) : [null, type];
  const claude = join(home, '.claude');
  const local = plugin ? [] : [...(ref.projectExists && ref.project ? [join(ref.project, '.claude', 'agents')] : []), join(claude, 'agents')];
  let file = await findIn(local, name);
  if (!file) {
    const { agents } = await pluginDefinitionFiles(join(claude, 'plugins'));
    file = await pickByName(agents, name, plugin, (f) => basename(f, '.md'));
  }
  return { agentType: type, file, builtIn: false };
}

/** From candidate files, the one named `name` — preferring one under the plugin's own folder. */
async function pickByName(files, name, plugin, nameOf) {
  const want = name.toLowerCase();
  let hits = files.filter((f) => nameOf(f).toLowerCase() === want);
  if (!hits.length) {
    hits = [];
    for (const f of files) if ((await declaredName(f))?.toLowerCase() === want) hits.push(f);
  }
  if (plugin) {
    const scoped = hits.filter((f) => f.split(/[\\/]/).some((seg) => seg.toLowerCase().startsWith(plugin.toLowerCase())));
    if (scoped.length) return scoped[0];
  }
  return hits[0] ?? null;
}

/**
 * Where a skill's SKILL.md is, by the name the Skill tool was called with:
 * `name`, `plugin:name`, or a folder-scoped `dir/sub:name`. Looked for in the
 * project's .claude/skills, ~/.claude/skills, then installed plugins. A skill
 * that ships inside Claude Code itself has no file: `{ file: null }`.
 * @returns {Promise<{ skill: string, file: string|null }>}
 */
export async function skillDefinition(ref, skill, { home = homedir() } = {}) {
  if (typeof skill !== 'string' || !skill.trim() || skill.length > 200) return { skill: String(skill ?? ''), file: null };
  const [scope, name] = skill.includes(':') ? skill.split(/:(.*)/s) : [null, skill];
  if (!/^[\w.-]+$/.test(name)) return { skill, file: null };
  const claude = join(home, '.claude');
  const local = [];
  const proj = ref.projectExists && ref.project ? ref.project : null;
  if (proj && scope && /^[\w./-]+$/.test(scope) && !scope.includes('..')) local.push(join(proj, scope, '.claude', 'skills', name, 'SKILL.md'));
  if (proj) local.push(join(proj, '.claude', 'skills', name, 'SKILL.md'));
  local.push(join(claude, 'skills', name, 'SKILL.md'));
  for (const f of local) if (await statOrNull(f)) return { skill, file: f };
  const { skills } = await pluginDefinitionFiles(join(claude, 'plugins'));
  const file = await pickByName(skills, name, scope, (f) => basename(dirname(f)));
  return { skill, file };
}
