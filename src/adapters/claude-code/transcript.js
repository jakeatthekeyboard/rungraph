import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readJsonLines, statOrNull } from '../../util.js';
import { contentText } from './helpers.js';

// The whole conversation, top to bottom, for the "full transcript" window:
// every prompt, every assistant text block, thinking, and every tool call with
// its result — nothing capped — and each subagent's own conversation nested
// under the call that spawned it. Read straight from the .jsonl files in file
// order; the graph's grouping and collapsing play no part.

const MAX_DEPTH = 6;

/** toolUseId → agentId, from the subagents folder's agent-<id>.meta.json files. */
async function agentIndex(dir) {
  const map = new Map();
  let names = [];
  try {
    names = await readdir(dir);
  } catch {
    return map;
  }
  for (const n of names) {
    const m = /^agent-([\w-]+)\.meta\.json$/.exec(n);
    if (!m) continue;
    try {
      const meta = JSON.parse(await readFile(join(dir, n), 'utf8'));
      if (typeof meta?.toolUseId === 'string') map.set(meta.toolUseId, { agentId: m[1], description: meta.description ?? null, agentType: meta.agentType ?? null });
    } catch {
      // half-written meta: that agent just stays un-nested
    }
  }
  return map;
}

const NOTE_PREFIX = /^\s*<(task-notification|system-reminder|local-command-|command-name|command-message|bash-|user-prompt-submit-hook)/;

function resultText(block) {
  const c = block?.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c))
    return c
      .map((b) => (b?.type === 'text' ? b.text : b?.type === 'image' ? '[image]' : b?.type ? `[${b.type}]` : ''))
      .filter(Boolean)
      .join('\n');
  return c == null ? '' : JSON.stringify(c, null, 2);
}

/** One .jsonl file → entries, with subagents resolved through `agents`. */
async function readConversation(file, ctx, depth) {
  const entries = [];
  const pending = new Map(); // tool_use id → the entry awaiting its result
  for await (const { obj } of readJsonLines(file)) {
    if (obj?.type !== 'user' && obj?.type !== 'assistant') {
      if (obj?.type === 'system' && obj.subtype === 'compact_boundary') entries.push({ role: 'event', text: 'conversation compacted', ts: obj.timestamp });
      continue;
    }
    const ts = obj.timestamp ?? null;
    const content = obj.message?.content;
    if (obj.type === 'user') {
      if (typeof content === 'string') {
        if (!content.trim()) continue;
        entries.push({ role: obj.isMeta || NOTE_PREFIX.test(content) ? 'note' : obj.isCompactSummary ? 'summary' : 'user', text: content, ts });
        continue;
      }
      for (const b of Array.isArray(content) ? content : []) {
        if (b?.type === 'tool_result') {
          const call = pending.get(b.tool_use_id);
          const text = resultText(b);
          if (call) {
            call.output = text;
            call.isError = b.is_error === true;
            call.endedAt = ts;
            pending.delete(b.tool_use_id);
          } else entries.push({ role: 'tool', name: '(result)', input: null, output: text, isError: b.is_error === true, ts });
        } else if (b?.type === 'text' && b.text?.trim()) {
          entries.push({ role: obj.isMeta || NOTE_PREFIX.test(b.text) ? 'note' : 'user', text: b.text, ts });
        } else if (b?.type === 'image') {
          entries.push({ role: 'user', text: '[image]', ts });
        }
      }
      continue;
    }
    // assistant
    for (const b of Array.isArray(content) ? content : []) {
      if (b?.type === 'text' && b.text?.trim()) entries.push({ role: 'assistant', text: b.text, ts, model: obj.message?.model ?? null });
      else if (b?.type === 'thinking' && typeof b.thinking === 'string' && b.thinking.trim()) entries.push({ role: 'thinking', text: b.thinking, ts });
      else if (b?.type === 'tool_use' || b?.type === 'server_tool_use') {
        const call = { role: 'tool', id: b.id, name: b.name ?? 'tool', input: b.input ?? null, output: null, isError: false, ts };
        const sub = ctx.agents?.get(b.id);
        if (sub && depth < MAX_DEPTH) {
          const subFile = join(ctx.subagentsDir, `agent-${sub.agentId}.jsonl`);
          if (await statOrNull(subFile)) {
            call.agent = {
              agentId: sub.agentId,
              description: sub.description,
              agentType: sub.agentType,
              entries: await readConversation(subFile, ctx, depth + 1),
            };
          }
        }
        entries.push(call);
        if (b.id) pending.set(b.id, call);
      }
    }
  }
  return entries;
}

/**
 * @returns {Promise<{ title: string, entries: object[] } | null>} null for a
 *   workflow run (its agents have no single conversation; the caller falls back).
 */
export async function transcript(ref) {
  if (ref.kind === 'workflow') return null;
  const subagentsDir = join(ref.projectDir, ref.sessionId, 'subagents');
  const agents = await agentIndex(subagentsDir);
  const entries = await readConversation(ref.sessionFile, { agents, subagentsDir }, 0);
  return { title: ref.title ?? ref.sessionId, entries };
}
