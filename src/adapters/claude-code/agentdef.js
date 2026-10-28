import { readdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
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

/** Plugin agents folders: marketplaces/<m>/plugins/<p>/agents and cache/<m>/<p>/<ver>/agents. */
async function pluginAgentDirs(root) {
  const dirs = [];
  const sub = async (d) => {
    try {
      return (await readdir(d, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => join(d, e.name));
    } catch {
      return [];
    }
  };
  for (const m of await sub(join(root, 'marketplaces'))) for (const p of await sub(join(m, 'plugins'))) dirs.push(join(p, 'agents'));
  for (const m of await sub(join(root, 'cache'))) for (const p of await sub(m)) for (const v of await sub(p)) dirs.push(join(v, 'agents'));
  return dirs;
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
  const dirs = plugin
    ? await pluginAgentDirs(join(claude, 'plugins'))
    : [...(ref.projectExists && ref.project ? [join(ref.project, '.claude', 'agents')] : []), join(claude, 'agents'), ...(await pluginAgentDirs(join(claude, 'plugins')))];
  const file = await findIn(dirs, name);
  return { agentType: type, file, builtIn: false };
}
