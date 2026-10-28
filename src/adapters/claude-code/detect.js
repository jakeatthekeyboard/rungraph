import { readdir, readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { headLines, tailLines, safeParseJson, statOrNull, shellQuote } from '../../util.js';
import { snippet } from '../../ir.js';

export const ADAPTER_NAME = 'claude-code';

const SESSION_FILE_RE = /^[0-9a-f-]{8,}\.jsonl$/;

/**
 * RunRef — the lightweight handle detect() produces and parse() consumes.
 * Built from stat + bounded head/tail chunk reads only; never a full parse.
 *
 * @typedef {Object} RunRef
 * @property {string} runId
 * @property {string} adapter
 * @property {'session'|'workflow'} kind
 * @property {string} title
 * @property {string} project      Display path of the project (cwd when known).
 * @property {boolean} projectFromCwd
 * @property {boolean} projectExists  Whether `project` is a directory on disk right now.
 * @property {string} projectDir   Absolute path of the provider's project dir.
 * @property {string} sessionId
 * @property {string} sessionFile  Absolute path of the main session .jsonl.
 * @property {string} [wfId]       Workflow runs only.
 * @property {string} [wfDir]
 * @property {string} [journalFile]
 * @property {string} [startedAt]
 * @property {string} modifiedAt
 * @property {number} sizeBytes
 */

/**
 * Find every Claude Code run under the given root dirs.
 * @param {string[]} rootDirs e.g. ['~/.claude/projects' resolved]
 * @returns {Promise<RunRef[]>}
 */
export async function detect(rootDirs) {
  const refs = [];
  for (const root of rootDirs) {
    if (basename(root) === COWORK_STORE) {
      for (const cowork of await coworkSessions(root)) {
        for (const ref of await detectRoot(cowork.projectsDir)) {
          ref.cowork = true;
          if (cowork.title && ref.kind === 'session') ref.title = snippet(cowork.title, 100);
          refs.push(ref);
        }
      }
      continue;
    }
    refs.push(...(await detectRoot(root)));
  }
  // runId tiebreak: same-mtime runs (a pinned fixture tree, a restore) must
  // still come back in one deterministic order.
  refs.sort((a, b) =>
    a.modifiedAt !== b.modifiedAt
      ? a.modifiedAt < b.modifiedAt
        ? 1
        : -1
      : a.runId < b.runId
        ? -1
        : a.runId > b.runId
          ? 1
          : 0,
  );
  return refs;
}

async function detectRoot(root) {
  const refs = [];
  for (const ent of await readdirOrEmpty(root, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    refs.push(...(await detectProject(join(root, ent.name))));
  }
  return refs;
}

/**
 * Claude desktop's Cowork mode runs Claude Code inside a VM and keeps each
 * session's ordinary Claude Code transcripts on the host at
 *   local-agent-mode-sessions/<account>/<org>/local_<id>/.claude/projects/
 * beside a `local_<id>.json` sidecar whose `title` is the name the desktop
 * app shows. Layout seen on Claude desktop, 2026-10-13.
 */
export const COWORK_STORE = 'local-agent-mode-sessions';

async function coworkSessions(store) {
  const out = [];
  for (const account of await readdirOrEmpty(store, { withFileTypes: true })) {
    if (!account.isDirectory()) continue;
    for (const org of await readdirOrEmpty(join(store, account.name), { withFileTypes: true })) {
      if (!org.isDirectory()) continue;
      const orgDir = join(store, account.name, org.name);
      for (const ent of await readdirOrEmpty(orgDir, { withFileTypes: true })) {
        if (!ent.isDirectory() || !ent.name.startsWith('local_')) continue;
        const sidecar = safeParseJson(await readFileOrEmpty(join(orgDir, `${ent.name}.json`)));
        out.push({
          projectsDir: join(orgDir, ent.name, '.claude', 'projects'),
          title: typeof sidecar?.title === 'string' ? sidecar.title : '',
        });
      }
    }
  }
  return out;
}

async function readFileOrEmpty(path) {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return '';
  }
}

async function detectProject(projectDir) {
  const refs = [];
  const entries = await readdirOrEmpty(projectDir, { withFileTypes: true });
  const sessionFiles = entries
    .filter((e) => e.isFile() && SESSION_FILE_RE.test(e.name))
    .map((e) => e.name);
  const dirs = new Set(
    entries.filter((e) => e.isDirectory()).map((e) => e.name),
  );
  // Sessions in one provider dir usually share a cwd — cache the existence
  // probe per path so a big project costs one stat, not one per session.
  const dirExists = new Map();

  for (const file of sessionFiles) {
    const sessionId = basename(file, '.jsonl');
    const sessionFile = join(projectDir, file);
    const st = await statOrNull(sessionFile);
    if (!st) continue;

    const peek = await peekSession(sessionFile, st.size);
    const project = peek.cwd || decodeProjectDirName(basename(projectDir));
    if (!dirExists.has(project)) {
      dirExists.set(project, (await statOrNull(project))?.isDirectory() ?? false);
    }
    const ref = {
      runId: `${ADAPTER_NAME}:${basename(projectDir)}:${sessionId}`,
      adapter: ADAPTER_NAME,
      kind: 'session',
      title: peek.title || '(untitled session)',
      project,
      projectFromCwd: Boolean(peek.cwd),
      projectExists: dirExists.get(project),
      projectDir,
      sessionId,
      sessionFile,
      startedAt: peek.startedAt,
      modifiedAt: st.mtime.toISOString(),
      sizeBytes: st.size,
    };
    if (dirs.has(sessionId)) {
      // Fold satellite files (agent transcripts, journals) into the run's
      // mtime/size so the live badge and cache keys see all activity.
      const agg = await runStats(ref);
      if (agg.maxMtimeMs > 0) {
        ref.modifiedAt = new Date(agg.maxMtimeMs).toISOString();
        ref.sizeBytes = agg.totalSize;
      }
    }
    refs.push(ref);

    // Workflow runs live under <projectDir>/<sessionId>/subagents/workflows/wf_*/
    if (dirs.has(sessionId)) {
      refs.push(...(await detectWorkflows(ref)));
    }
  }
  return refs;
}

async function detectWorkflows(sessionRef) {
  const refs = [];
  const wfRoot = join(sessionRef.projectDir, sessionRef.sessionId, 'subagents', 'workflows');
  const entries = await readdirOrEmpty(wfRoot, { withFileTypes: true });
  for (const ent of entries) {
    if (!ent.isDirectory() || !ent.name.startsWith('wf_')) continue;
    const wfDir = join(wfRoot, ent.name);
    const journalFile = join(wfDir, 'journal.jsonl');
    const jst = await statOrNull(journalFile);
    if (!jst) continue;
    const ref = {
      runId: `${sessionRef.runId}:${ent.name}`,
      adapter: ADAPTER_NAME,
      kind: 'workflow',
      title: (await workflowTitle(sessionRef, ent.name)) || ent.name,
      project: sessionRef.project,
      projectFromCwd: sessionRef.projectFromCwd,
      projectExists: sessionRef.projectExists,
      projectDir: sessionRef.projectDir,
      sessionId: sessionRef.sessionId,
      sessionFile: sessionRef.sessionFile,
      wfId: ent.name,
      wfDir,
      journalFile,
      modifiedAt: jst.mtime.toISOString(),
      sizeBytes: jst.size,
    };
    const agg = await runStats(ref);
    if (agg.maxMtimeMs > 0) {
      ref.modifiedAt = new Date(agg.maxMtimeMs).toISOString();
      ref.sizeBytes = agg.totalSize;
    }
    refs.push(ref);
  }
  return refs;
}

/**
 * Workflow scripts are persisted at <sessionId>/workflows/scripts/<name>-<wfId>.js,
 * which gives us the workflow's meta.name without parsing anything.
 */
async function workflowTitle(sessionRef, wfId) {
  const scriptsDir = join(sessionRef.projectDir, sessionRef.sessionId, 'workflows', 'scripts');
  const names = await readdirOrEmpty(scriptsDir);
  const hit = names.find((n) => n.endsWith(`-${wfId}.js`));
  return hit ? hit.slice(0, -(`-${wfId}.js`.length)) : undefined;
}

/**
 * Bounded look at a session file: title (ai-title > last-prompt > first user
 * prompt), cwd, and first timestamp. Reads at most one head + one tail chunk.
 */
async function peekSession(sessionFile, sizeBytes) {
  const head = (await headLines(sessionFile)).map(safeParseJson).filter(Boolean);
  const tail =
    sizeBytes > 65536
      ? (await tailLines(sessionFile)).map(safeParseJson).filter(Boolean)
      : head;

  const out = { title: '', cwd: undefined, startedAt: undefined };
  for (const obj of head) {
    if (!out.cwd && typeof obj.cwd === 'string') out.cwd = obj.cwd;
    if (!out.startedAt && typeof obj.timestamp === 'string') out.startedAt = obj.timestamp;
    if (out.cwd && out.startedAt) break;
  }

  const pick = (lines, type, field) => {
    for (let i = lines.length - 1; i >= 0; i--) {
      const o = lines[i];
      if (o.type === type && typeof o[field] === 'string' && o[field]) return o[field];
    }
    return undefined;
  };

  out.title =
    pick(tail, 'ai-title', 'aiTitle') ??
    pick(head, 'ai-title', 'aiTitle') ??
    pick(tail, 'last-prompt', 'lastPrompt') ??
    firstUserSnippet(head) ??
    '';
  out.title = snippet(out.title, 100);
  return out;
}

function firstUserSnippet(lines) {
  for (const o of lines) {
    if (o.type !== 'user' || o.isMeta) continue;
    const c = o.message?.content;
    if (typeof c === 'string' && c.trim() && !c.startsWith('<')) return c;
    if (Array.isArray(c)) {
      const t = c.find((b) => b.type === 'text' && typeof b.text === 'string' && b.text.trim());
      if (t && !t.text.startsWith('<')) return t.text;
    }
  }
  return undefined;
}

/**
 * Claude Code encodes the project cwd by replacing path separators (and dots)
 * with '-'. The mapping is lossy, so we only use it as a display fallback when
 * no session line gave us a real cwd.
 */
function decodeProjectDirName(name) {
  return name.replace(/^-/, '/').replace(/-/g, '/');
}

async function readdirOrEmpty(dir, opts) {
  try {
    return await readdir(dir, opts);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// File-layout knowledge exposed to the vendor-neutral layers. The scanner,
// server, and watcher call these instead of knowing the layout themselves.
// ---------------------------------------------------------------------------

/** Every file belonging to a run (bounded readdir walk, no parsing). */
async function runFilePaths(ref) {
  if (ref.kind === 'workflow') {
    // Only the workflow's own files — the parent session file is a separate
    // run and would mark every workflow of a live session as live.
    const paths = [];
    for (const n of await readdirOrEmpty(ref.wfDir)) paths.push(join(ref.wfDir, n));
    paths.push(join(ref.projectDir, ref.sessionId, 'workflows', `${ref.wfId}.json`));
    return paths;
  }
  const paths = [ref.sessionFile];
  const sub = join(ref.projectDir, ref.sessionId, 'subagents');
  for (const ent of await readdirOrEmpty(sub, { withFileTypes: true })) {
    if (ent.isFile()) paths.push(join(sub, ent.name));
  }
  const wfRoot = join(sub, 'workflows');
  for (const ent of await readdirOrEmpty(wfRoot, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    for (const n of await readdirOrEmpty(join(wfRoot, ent.name))) {
      paths.push(join(wfRoot, ent.name, n));
    }
  }
  const wfMeta = join(ref.projectDir, ref.sessionId, 'workflows');
  for (const ent of await readdirOrEmpty(wfMeta, { withFileTypes: true })) {
    if (ent.isFile()) paths.push(join(wfMeta, ent.name));
  }
  return paths;
}

/** Aggregate {maxMtimeMs, totalSize} over a run's whole file set — CURRENT, not cached. */
export async function runStats(ref) {
  let maxMtimeMs = 0;
  let totalSize = 0;
  for (const p of await runFilePaths(ref)) {
    const st = await statOrNull(p);
    if (!st) continue;
    maxMtimeMs = Math.max(maxMtimeMs, st.mtimeMs);
    totalSize += st.size;
  }
  return { maxMtimeMs, totalSize };
}

/**
 * Cheap cache key covering every file of the run (satellite agent
 * transcripts grow without touching the main file).
 */
export async function fingerprint(ref) {
  const { maxMtimeMs, totalSize } = await runStats(ref);
  return `${maxMtimeMs}:${totalSize}`;
}

/** What the live-tail watcher should watch for this run. */
export function watchTargets(ref) {
  const targets = [{ path: ref.sessionFile, recursive: false }];
  if (ref.kind === 'workflow') {
    targets.push({ path: ref.wfDir, recursive: true });
  } else {
    targets.push({ path: join(ref.projectDir, ref.sessionId), recursive: true });
    // The session dir may not exist yet — watching the project dir lets the
    // watcher re-arm when it appears.
    targets.push({ path: ref.projectDir, recursive: false });
  }
  return targets;
}

/**
 * Fallback --project matcher for runs whose transcript never revealed a cwd:
 * Claude Code encodes the cwd into the project dir name by replacing
 * path separators and dots with '-'.
 */
export function matchesProject(ref, resolvedPath) {
  return basename(ref.projectDir) === resolvedPath.replace(/[/.]/g, '-');
}

/**
 * The transcript file a node was read from, for "show file". An agent node
 * has its own transcript — `<session>/subagents/agent-<id>.jsonl`, or
 * `<wfDir>/agent-<id>.jsonl` inside a workflow run — when that file exists;
 * every other node comes from the session file (a workflow run's own nodes
 * from its journal).
 */
export async function sourceFile(ref, node) {
  if (node?.kind === 'agent' && typeof node.agentId === 'string' && /^[\w-]+$/.test(node.agentId)) {
    const dir = ref.kind === 'workflow' ? ref.wfDir : join(ref.projectDir, ref.sessionId, 'subagents');
    const file = dir ? join(dir, `agent-${node.agentId}.jsonl`) : null;
    if (file && (await statOrNull(file))) return file;
  }
  return ref.kind === 'workflow' ? (ref.journalFile ?? ref.sessionFile) : ref.sessionFile;
}

/**
 * How to continue this session in a real terminal. Pure string construction
 * from the RunRef — the existence probe behind `projectExists` already ran in
 * detect(), where the I/O lives.
 *
 * Verified against Claude Code ≥ 2.1.223 (2026-08-17): `claude --resume <id>`
 * finds the session from ANY directory, so the copy string carries no `cd`;
 * `--fork-session` resumes a copy, leaving the original transcript untouched.
 * Workflow rows are not conversations — their parent session is the thing to
 * resume, from its own row.
 *
 * @param {RunRef} ref
 * @returns {{ argv: string[], forkArgv: string[], cwd: string|null,
 *             copyCommand: string, forkCopyCommand: string }|null}
 */
export function resumeInfo(ref) {
  // Cowork sessions live inside the desktop app's VM; `claude --resume` on
  // the host cannot find them.
  if (ref.kind !== 'session' || ref.cowork) return null;
  const argv = ['claude', '--resume', ref.sessionId];
  const forkArgv = [...argv, '--fork-session'];
  return {
    argv,
    forkArgv,
    cwd: ref.projectExists ? ref.project : null,
    copyCommand: argv.map(shellQuote).join(' '),
    forkCopyCommand: forkArgv.map(shellQuote).join(' '),
  };
}
