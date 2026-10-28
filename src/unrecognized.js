import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const VERSION = (() => {
  try {
    return require('../package.json').version;
  } catch {
    return 'unknown';
  }
})();

/**
 * The unrecognized-records report as paste-ready Markdown: what to fix, for
 * whom, and the shape of each skipped record. Written to be pasted into an
 * agent session working on rungraph's adapter.
 */
export function formatUnrecognized(runId, adapter, report) {
  const lines = [
    `# rungraph: unrecognized transcript records`,
    ``,
    `- rungraph ${VERSION}, adapter \`${adapter}\``,
    `- run \`${runId}\``,
    `- ${report.total} record${report.total === 1 ? '' : 's'} skipped across ${report.files.length} file${report.files.length === 1 ? '' : 's'} scanned`,
    ...(Number.isFinite(report.graphCount) && report.graphCount !== report.total
      ? [
          `- the graph counted ${report.graphCount}: it reads only the subagent transcripts linked from the session, while this report scans every transcript file on disk`,
        ]
      : []),
    ``,
    `The parser skipped these records, so the graph may be missing what they describe. ` +
      `Each shape below is the record with its values replaced by placeholders (\`<string N>\` is a string of N characters). ` +
      `Teach the ${adapter} adapter these record types, or confirm they are safe to ignore and add them to the known set.`,
  ];
  for (const g of report.groups) {
    lines.push(``, `## \`${g.type}\` ×${g.count} — ${g.reason}`);
    for (const s of g.samples) {
      lines.push(``, `${s.file}:${s.line}`);
      if (s.shape != null) lines.push('```json', JSON.stringify(s.shape, null, 2), '```');
    }
  }
  if (!report.groups.length) lines.push(``, `(No skipped records found on disk now — the file may have changed since the graph was drawn.)`);
  return lines.join('\n');
}
