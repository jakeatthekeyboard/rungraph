import { createContext, render } from 'preact';
import { useContext, useEffect, useState } from 'preact/hooks';
import { Markdown } from './markdown-view.jsx';
import { JsonView, JSON_VIEW_CSS } from './json-view.jsx';
import { fetchTranscript } from './api.js';

// The "full transcript" window: the run's whole conversation, top to bottom,
// laid out like a chat — your prompts as bubbles, the assistant's text as
// rendered Markdown, each tool call a one-line card that opens to its full
// input and output, and each subagent's own conversation nested inside the
// call that spawned it. Text is always shown as text (textContent / the
// Markdown tree), never run as HTML.

// "expand all" / "collapse all": a request every card obeys once, by seq.
const Fold = createContext({ seq: 0, open: false });

function Collapsible({ summary, cls, initiallyOpen = false, children }) {
  const fold = useContext(Fold);
  const [open, setOpen] = useState(initiallyOpen);
  useEffect(() => {
    if (fold.seq) setOpen(fold.open);
  }, [fold.seq]);
  return (
    <div class={`tx-card ${cls ?? ''}`} data-open={String(open)}>
      <button class="tx-sum" onClick={() => setOpen(!open)} aria-expanded={String(open)}>
        <span class="tx-chev" aria-hidden="true">{open ? '▾' : '▸'}</span>
        {summary}
      </button>
      {/* Rendered only when open: a long run's tool output would otherwise
          build megabytes of DOM nobody asked to read. */}
      {open && <div class="tx-body">{children()}</div>}
    </div>
  );
}

const firstString = (o) => (o && typeof o === 'object' ? Object.values(o).find((v) => typeof v === 'string') : null);

/** The one line a tool card shows closed. */
function toolSummary(e) {
  const i = e.input && typeof e.input === 'object' ? e.input : null;
  const hint =
    i?.description ?? i?.command ?? i?.file_path ?? i?.notebook_path ?? i?.pattern ?? i?.url ?? i?.query ?? i?.prompt ?? firstString(i) ?? (typeof e.input === 'string' ? e.input : '');
  const one = String(hint ?? '').split('\n')[0];
  return one.length > 140 ? `${one.slice(0, 140)}…` : one;
}

const fmtTime = (ts) => {
  const t = ts ? new Date(ts) : null;
  return t && !Number.isNaN(t.getTime()) ? t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
};

function Entries({ entries, nested = false }) {
  return entries.map((e, i) => <Entry entry={e} key={i} nested={nested} />);
}

function Entry({ entry: e, nested }) {
  switch (e.role) {
    case 'user':
      return (
        <div class="tx-user">
          {/* Inside a subagent the "user" is the agent that spawned it. */}
          <div class="tx-meta">{nested ? 'parent agent' : 'you'} · {fmtTime(e.ts)}</div>
          <div class="tx-bubble">{e.text}</div>
        </div>
      );
    case 'assistant':
      return (
        <div class="tx-assistant">
          <div class="md">
            <Markdown text={e.text} />
          </div>
        </div>
      );
    case 'thinking':
      return (
        <Collapsible cls="tx-thinking" summary={<span class="tx-label">thinking</span>}>
          {() => <div class="tx-pre">{e.text}</div>}
        </Collapsible>
      );
    case 'note':
    case 'summary':
      return (
        <Collapsible cls="tx-note" summary={<span class="tx-label">{e.role === 'summary' ? 'compaction summary' : 'system note'} · {e.text.split('\n')[0].slice(0, 90)}</span>}>
          {() => <div class="tx-pre">{e.text}</div>}
        </Collapsible>
      );
    case 'event':
      return <div class="tx-event">— {e.text} —</div>;
    case 'tool':
      if (e.agent) {
        return (
          <Collapsible
            cls="tx-agent"
            summary={
              <>
                <span class="tx-tool">Agent</span>
                <span class="tx-hint">{e.agent.description ?? toolSummary(e)}</span>
                <span class="tx-count">{e.agent.entries.length} entries</span>
              </>
            }
          >
            {() => (
              <>
                {/* The subagent's own transcript opens with the prompt it was
                    given, so the call's input is only shown when it does not. */}
                {e.input && e.agent.entries[0]?.role !== 'user' && (
                  <Collapsible cls="tx-io" summary={<span class="tx-label">prompt given</span>} initiallyOpen>
                    {() => <IO value={e.input} />}
                  </Collapsible>
                )}
                <div class="tx-nested">
                  <Entries entries={e.agent.entries} nested />
                </div>
                {e.output != null && (
                  <Collapsible cls="tx-io" summary={<span class="tx-label">returned</span>}>
                    {() => <IO value={e.output} />}
                  </Collapsible>
                )}
              </>
            )}
          </Collapsible>
        );
      }
      return (
        <Collapsible
          cls={`tx-call${e.isError ? ' tx-err' : ''}`}
          summary={
            <>
              <span class="tx-tool">{e.name}</span>
              <span class="tx-hint">{toolSummary(e)}</span>
              {e.isError && <span class="tx-badge">error</span>}
            </>
          }
        >
          {() => (
            <>
              {e.input != null && (
                <>
                  <div class="tx-label">input</div>
                  <IO value={e.input} />
                </>
              )}
              <div class="tx-label">{e.output == null ? 'no result recorded' : 'output'}</div>
              {e.output != null && <IO value={e.output} />}
            </>
          )}
        </Collapsible>
      );
    default:
      return null;
  }
}

/** A tool input or output: objects as the JSON tree, text as text. */
function IO({ value }) {
  if (value && typeof value === 'object') return <div class="tx-json"><JsonView value={value} /></div>;
  return <div class="tx-pre">{String(value)}</div>;
}

function Transcript({ runId, title }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [fold, setFold] = useState({ seq: 0, open: false });
  useEffect(() => {
    fetchTranscript(runId).then(setData, (err) => setError(String(err?.message ?? err)));
  }, [runId]);
  return (
    <Fold.Provider value={fold}>
      <div class="tx">
        <header class="tx-head">
          <h1>{data?.title || title}</h1>
          <div class="tx-tools">
            <span class="tx-src">
              {data ? `${data.entries.length} entries · ${data.source === 'graph' ? 'rebuilt from the graph' : 'read from the transcript'}` : ''}
            </span>
            <button onClick={() => setFold((f) => ({ seq: f.seq + 1, open: true }))}>expand all</button>
            <button onClick={() => setFold((f) => ({ seq: f.seq + 1, open: false }))}>collapse all</button>
          </div>
        </header>
        {error ? <p class="tx-error">could not load the transcript: {error}</p> : !data ? <p class="tx-loading">reading the transcript…</p> : <Entries entries={data.entries} />}
      </div>
    </Fold.Provider>
  );
}

const TX_CSS = `
  body { margin: 0; background: var(--bg); color: var(--ink); font: 14px/1.6 var(--ui, system-ui, sans-serif); }
  .tx { max-width: 920px; margin: 0 auto; padding: 0 24px 80px; }
  .tx-head { position: sticky; top: 0; z-index: 2; background: var(--bg); padding: 16px 0 10px; border-bottom: 1px solid var(--hairline-soft); margin-bottom: 18px; }
  .tx-head h1 { font-size: 17px; margin: 0 0 6px; }
  .tx-tools { display: flex; gap: 8px; align-items: center; }
  .tx-src { flex: 1; color: var(--ink-faint); font-size: 12px; }
  .tx-tools button { font: inherit; font-size: 12px; color: var(--ink-dim); background: var(--bg-raised); border: 1px solid var(--hairline-soft); border-radius: 5px; padding: 3px 9px; cursor: pointer; }
  .tx-tools button:hover { color: var(--ink); }
  .tx-user { display: flex; flex-direction: column; align-items: flex-end; margin: 22px 0 12px; }
  .tx-bubble { max-width: 78%; white-space: pre-wrap; overflow-wrap: anywhere; background: var(--bg-raised); border: 1px solid var(--hairline-soft); border-radius: 14px 14px 4px 14px; padding: 9px 13px; }
  .tx-meta { font-size: 11px; color: var(--ink-faint); margin-bottom: 3px; }
  .tx-assistant { margin: 8px 0; }
  .tx-card { margin: 4px 0; border: 1px solid var(--hairline-soft); border-radius: 8px; background: color-mix(in srgb, var(--bg-raised) 45%, var(--bg)); }
  .tx-card[data-open="true"] { background: var(--bg); }
  .tx-sum { display: flex; gap: 8px; align-items: baseline; width: 100%; text-align: left; font: inherit; font-size: 13px; color: var(--ink-dim); background: none; border: none; padding: 5px 10px; cursor: pointer; }
  .tx-sum:hover { color: var(--ink); }
  .tx-chev { flex: none; width: 1em; color: var(--ink-faint); }
  .tx-tool { flex: none; font-family: var(--mono); font-weight: 600; color: var(--ink); }
  .tx-hint { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--mono); font-size: 12px; }
  .tx-count, .tx-label { color: var(--ink-faint); font-size: 12px; }
  .tx-badge { flex: none; font-size: 11px; color: var(--clay); border: 1px solid var(--clay); border-radius: 4px; padding: 0 5px; }
  .tx-err { border-color: color-mix(in srgb, var(--clay) 55%, transparent); }
  .tx-body { padding: 4px 12px 10px 28px; }
  .tx-body > .tx-label { margin: 8px 0 3px; }
  .tx-pre, .tx-json { font-family: var(--mono); font-size: 12px; line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; max-height: 70vh; overflow: auto; background: var(--bg-raised); border-radius: 6px; padding: 8px 10px; }
  .tx-json { white-space: normal; }
  .tx-agent { border-color: color-mix(in srgb, var(--sage) 45%, transparent); }
  .tx-nested { border-left: 2px solid color-mix(in srgb, var(--sage) 40%, transparent); padding-left: 14px; margin: 8px 0; }
  .tx-thinking .tx-pre, .tx-note .tx-pre { color: var(--ink-dim); }
  .tx-thinking, .tx-note { border-style: dashed; }
  .tx-event { text-align: center; color: var(--ink-faint); font-size: 12px; margin: 14px 0; }
  .tx-loading, .tx-error { color: var(--ink-dim); }
  .md { overflow-wrap: anywhere; }
  .md > :first-child { margin-top: 0; }
  .md p { margin: 0 0 10px; }
  .md .md-h { margin: 16px 0 6px; line-height: 1.3; }
  .md .md-h1 { font-size: 19px; } .md .md-h2 { font-size: 17px; } .md .md-h3, .md .md-h4, .md .md-h5, .md .md-h6 { font-size: 15px; }
  .md ul, .md ol { margin: 0 0 10px; padding-left: 22px; }
  .md li { margin: 3px 0; }
  .md code { font-family: var(--mono); font-size: 0.88em; padding: 1px 4px; border-radius: 4px; background: var(--bg-raised); }
  .md pre.md-code { font-family: var(--mono); font-size: 12px; white-space: pre-wrap; overflow-wrap: anywhere; background: var(--bg-raised); border-radius: 6px; padding: 8px 10px; margin: 6px 0 12px; }
  .md blockquote { margin: 0 0 10px; padding: 2px 0 2px 12px; border-left: 3px solid var(--hairline); color: var(--ink-dim); }
  .md hr { border: none; border-top: 1px solid var(--hairline-soft); margin: 12px 0; }
  .md a { color: var(--accent, var(--ink)); }
  .md .md-table { overflow-x: auto; margin: 0 0 10px; }
  .md table { border-collapse: collapse; font-size: 13px; }
  .md th, .md td { border: 1px solid var(--hairline-soft); padding: 3px 8px; text-align: left; vertical-align: top; }
  .md th { background: var(--bg-raised); }
  ${JSON_VIEW_CSS}
`;

const THEME_VARS = ['--bg', '--bg-raised', '--ink', '--ink-dim', '--ink-faint', '--sage', '--amber', '--clay', '--hairline', '--hairline-soft', '--mono', '--ui', '--accent'];

/**
 * Open the run's full transcript in a new browser window. The window is
 * opened at once (inside the click, so it is never popup-blocked) and fills
 * itself when the transcript arrives.
 */
export function openTranscriptWindow(runId, title) {
  const win = window.open('', '_blank', 'popup,width=1000,height=900');
  if (!win) return false;
  const css = getComputedStyle(document.documentElement);
  const vars = THEME_VARS.map((n) => `${n}: ${css.getPropertyValue(n).trim()};`).join(' ');
  const doc = win.document;
  doc.title = `transcript · ${title || runId}`;
  const style = doc.createElement('style');
  style.textContent = `:root { ${vars} color-scheme: ${document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'}; } ${TX_CSS}`;
  doc.head.appendChild(style);
  const root = doc.createElement('div');
  doc.body.appendChild(root);
  render(<Transcript runId={runId} title={title} />, root);
  return true;
}
