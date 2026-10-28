// Which definition files a run's nodes ran from: an agent node's agent .md
// (or "built in"), and the SKILL.md of every skill it — or a Skill tool node —
// called. Looked up on this machine after the parse (the adapters read only
// the run's own files), and stored on the node as `definitions` so the canvas
// can name the file and the inspector can list and reveal it. Paths are local:
// bundles parse without this step, so an export never carries them.

const safeJson = (s) => {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};

/** Skill names called in a tool node's calls or an agent's transcript. */
function skillNames(node, detail) {
  const names = new Set();
  const take = (input) => {
    const o = typeof input === 'string' ? safeJson(input) : input;
    if (o && typeof o.skill === 'string') names.add(o.skill);
  };
  if (node.kind === 'tool' && /^Skill\b/.test(node.label ?? '')) {
    for (const c of detail?.calls ?? []) take(c.input);
    const m = /^Skill · ([^\s×]+)/.exec(node.label ?? '');
    if (!names.size && m) names.add(m[1]);
  }
  if (node.kind === 'agent') for (const t of detail?.transcript ?? []) if (t.toolName === 'Skill') take(t.text);
  return [...names];
}

/**
 * Attach `definitions` to agent and Skill nodes. Never throws: a lookup that
 * fails leaves the node as it was.
 * @param {object} adapter  the run's adapter (uses agentDefinition / skillDefinition when present)
 */
export async function attachDefinitions(adapter, ref, ir, details) {
  if (!adapter?.agentDefinition && !adapter?.skillDefinition) return ir;
  const skillCache = new Map();
  const skill = async (name) => {
    if (!skillCache.has(name)) skillCache.set(name, adapter.skillDefinition ? adapter.skillDefinition(ref, name).catch(() => ({ skill: name, file: null })) : { skill: name, file: null });
    return skillCache.get(name);
  };
  for (const node of ir.nodes) {
    try {
      const defs = {};
      if (node.kind === 'agent' && adapter.agentDefinition) {
        const d = await adapter.agentDefinition(ref, node);
        if (d?.agentType) defs.agent = { type: d.agentType, file: d.file, builtIn: Boolean(d.builtIn) };
      }
      const names = skillNames(node, details?.get(node.id));
      if (names.length) defs.skills = await Promise.all(names.map(async (n) => ({ name: n, file: (await skill(n)).file })));
      if (defs.agent || defs.skills) node.definitions = defs;
    } catch {
      // leave this node undecorated
    }
  }
  return ir;
}

/** The one line the canvas shows for a node's definition, or null. */
export function definitionLine(node) {
  const d = node?.definitions;
  if (!d) return null;
  if (d.agent) return d.agent.file ? d.agent.file.split(/[\\/]/).pop() : `${d.agent.type}${d.agent.builtIn ? ' · built in' : ''}`;
  if (d.skills?.length) {
    const s = d.skills[0];
    const first = s.file ? `${s.file.split(/[\\/]/).slice(-2).join('/')}` : `${s.name} · built in`;
    return d.skills.length > 1 ? `${first} +${d.skills.length - 1}` : first;
  }
  return null;
}
