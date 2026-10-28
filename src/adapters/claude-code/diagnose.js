import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { readJsonLines, statOrNull } from '../../util.js';
import { KNOWN_AGENT_TYPES, KNOWN_MAIN_TYPES, SHAPE_GATED_MAIN_TYPES, isKnownMainLine } from './helpers.js';

// The "records unrecognized" banner's detail: which records the parser
// skipped, why, and where — enough to teach the adapter a new record type.
// Each record is described by its SHAPE (keys, nesting, value types) with the
// values replaced, so the report can be pasted into a chat without carrying
// the transcript's content. `type`/`subtype` stay verbatim when they look like
// identifiers: they are the vocabulary the fix needs.

const SAMPLES_PER_GROUP = 2;

/** A run's files and the gate each one's records must pass. */
async function filesFor(ref) {
  const out = [];
  const agentFiles = async (dir) => {
    let names = [];
    try {
      names = await readdir(dir);
    } catch {
      return;
    }
    for (const n of names.filter((n) => /^agent-[\w-]+\.jsonl$/.test(n)).sort()) {
      out.push({ file: join(dir, n), gate: 'agent' });
    }
  };
  if (ref.kind === 'workflow') {
    if (ref.journalFile && (await statOrNull(ref.journalFile))) out.push({ file: ref.journalFile, gate: 'journal' });
    if (ref.wfDir) await agentFiles(ref.wfDir);
  } else {
    out.push({ file: ref.sessionFile, gate: 'main' });
    await agentFiles(join(ref.projectDir, ref.sessionId, 'subagents'));
  }
  return out;
}

/** Why a record was skipped, or null when the gate accepts it. */
function verdict(gate, obj) {
  const t = obj?.type;
  if (gate === 'main') {
    if (isKnownMainLine(obj)) return null;
    if (typeof t !== 'string') return 'no string `type` field';
    if (SHAPE_GATED_MAIN_TYPES.has(t)) return 'known type, but its fields did not match the expected shape';
    return KNOWN_MAIN_TYPES.has(t) ? 'known type rejected' : 'unknown record type (main session file)';
  }
  if (gate === 'agent') {
    if (typeof t === 'string' && KNOWN_AGENT_TYPES.has(t)) return null;
    return typeof t === 'string' ? 'unknown record type (subagent transcript)' : 'no string `type` field';
  }
  // journal
  if ((t === 'started' || t === 'result') && obj.agentId) return null;
  return typeof t === 'string' ? 'unknown record type (workflow journal)' : 'no string `type` field';
}

const IDENT = /^[\w.:-]{1,64}$/;

/** A value's shape: strings, numbers and booleans become placeholders. */
export function skeleton(v, depth = 0, key = '') {
  if (v === null) return null;
  if (typeof v === 'string') {
    if ((key === 'type' || key === 'subtype') && IDENT.test(v)) return v;
    return `<string ${v.length}>`;
  }
  if (typeof v === 'number') return '<number>';
  if (typeof v === 'boolean') return '<boolean>';
  if (depth >= 4) return Array.isArray(v) ? `<array ${v.length}>` : '<object>';
  if (Array.isArray(v)) {
    if (!v.length) return [];
    const out = [skeleton(v[0], depth + 1)];
    if (v.length > 1) out.push(`…${v.length - 1} more`);
    return out;
  }
  const out = {};
  const keys = Object.keys(v);
  for (const k of keys.slice(0, 30)) out[k] = skeleton(v[k], depth + 1, k);
  if (keys.length > 30) out['…'] = `${keys.length - 30} more keys`;
  return out;
}

/**
 * Every record the parser would skip, grouped by type and reason.
 * @returns {Promise<{ total: number, files: string[], groups: Array<{ type: string, reason: string, count: number, samples: Array<{ file: string, line: number, shape: unknown }> }> }>}
 */
export async function unrecognizedReport(ref) {
  const files = await filesFor(ref);
  const groups = new Map();
  let total = 0;
  const add = (type, reason, file, line, shape) => {
    total++;
    const key = `${type}\n${reason}`;
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { type, reason, count: 0, samples: [] }));
    g.count++;
    if (g.samples.length < SAMPLES_PER_GROUP) g.samples.push({ file, line, shape });
  };
  for (const { file, gate } of files) {
    const bad = [];
    let last = 0;
    try {
      for await (const { obj, lineNo } of readJsonLines(file, { onBadLine: (_l, n) => bad.push(n) })) {
        last = Math.max(last, lineNo);
        const why = verdict(gate, obj);
        if (why) add(typeof obj?.type === 'string' && IDENT.test(obj.type) ? obj.type : '(none)', why, file, lineNo, skeleton(obj));
      }
    } catch {
      continue; // unreadable file: the coverage badge already counts it
    }
    // A bad FINAL line is a write in progress, not drift — the parser skips it too.
    last = Math.max(last, ...bad, 0);
    for (const n of bad) if (n !== last) add('(invalid JSON)', 'line is not valid JSON', file, n, null);
  }
  return {
    total,
    files: files.map((f) => f.file),
    groups: [...groups.values()].sort((a, b) => b.count - a.count),
  };
}
