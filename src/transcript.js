import { runOrder } from './timeline.js';

// The "full transcript" for adapters (and Claude Code workflow runs) that do
// not read their files directly: rebuilt from the graph in run order, using
// uncapped detail payloads. Coarser than a direct read — a turn holds its
// prompt and final response, and the text between tool calls survives only as
// each tool group's "why" — but every adapter gets a readable conversation.

const parseInput = (s) => {
  if (typeof s !== 'string') return s ?? null;
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
};

export function transcriptFromGraph(ir, details) {
  const entries = [];
  for (const n of runOrder(ir.nodes)) {
    const d = details.get(n.id);
    if (!d) continue;
    const ts = n.startedAt ?? null;
    if (d.kind === 'turn') {
      if (d.prompt) entries.push({ role: 'user', text: d.prompt, ts });
      if (d.responseText) entries.push({ role: 'assistant', text: d.responseText, ts: n.endedAt ?? ts });
    } else if (d.kind === 'tool') {
      if (d.context) entries.push({ role: 'assistant', text: d.context, ts });
      const name = String(n.label ?? 'tool').split(' · ')[0];
      for (const c of d.calls ?? []) {
        entries.push({ role: 'tool', name, input: parseInput(c.input), output: c.output ?? null, isError: Boolean(c.isError), ts: c.startedAt ?? ts });
      }
    } else if (d.kind === 'agent') {
      entries.push({
        role: 'tool',
        name: 'Agent',
        input: { description: n.label, prompt: d.prompt ?? '' },
        output: d.result ?? d.error ?? null,
        isError: Boolean(d.error),
        ts,
        agent: {
          agentId: n.agentId ?? null,
          description: n.label,
          entries: (d.transcript ?? []).map((t) =>
            t.toolName
              ? { role: 'tool', name: t.toolName, input: parseInput(t.text), output: null, isError: false }
              : { role: t.role === 'assistant' ? 'assistant' : 'user', text: t.text },
          ),
        },
      });
    } else if (d.kind === 'human') {
      entries.push({ role: 'note', text: [d.context, d.answer].filter(Boolean).join('\n\n'), ts });
    } else if (d.kind === 'workflow' && d.returnValue != null) {
      entries.push({ role: 'assistant', text: String(d.returnValue), ts });
    }
  }
  return { title: ir.meta?.title ?? ir.meta?.runId ?? '', entries };
}
