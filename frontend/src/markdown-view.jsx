import { looksLikeMarkdown, parseMarkdown } from './markdown.js';
import { prettyText } from './pretty.js';

/**
 * How a text box shows its text when the header's "style" switch is on:
 * complete JSON pretty-printed, Markdown rendered, anything else as-is.
 * Returns null when there is nothing to style (the box keeps its <pre>).
 */
export function styledKind(text) {
  if (typeof text !== 'string') return null;
  if (prettyText(text) !== text) return 'json';
  if (looksLikeMarkdown(text)) return 'markdown';
  return null;
}

export function Markdown({ text }) {
  return <>{parseMarkdown(text).map((b, i) => <Block block={b} key={i} />)}</>;
}

function Block({ block: b }) {
  switch (b.type) {
    case 'heading': {
      const H = `h${Math.min(6, b.level + 2)}`; // h1 → h3: the pane already has its own h2
      return <H class={`md-h md-h${b.level}`}><Inline runs={b.content} /></H>;
    }
    case 'paragraph':
      return <p><Inline runs={b.content} /></p>;
    case 'code':
      return <pre class="md-code">{b.text}</pre>;
    case 'rule':
      return <hr />;
    case 'quote':
      return <blockquote>{b.blocks.map((x, i) => <Block block={x} key={i} />)}</blockquote>;
    case 'list':
      return <List list={b} />;
    case 'table':
      return (
        <div class="md-table">
          <table>
            <thead>
              <tr>{b.head.map((c, i) => <th key={i}><Inline runs={c} /></th>)}</tr>
            </thead>
            <tbody>
              {b.rows.map((r, i) => (
                <tr key={i}>{r.map((c, j) => <td key={j}><Inline runs={c} /></td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    default:
      return null;
  }
}

function List({ list }) {
  const L = list.ordered ? 'ol' : 'ul';
  return (
    <L>
      {list.items.map((it, i) => (
        <li key={i}>
          <Inline runs={it.content} />
          {it.sub && <List list={it.sub} />}
        </li>
      ))}
    </L>
  );
}

function Inline({ runs }) {
  return (
    <>
      {runs.map((r, i) => {
        if (typeof r === 'string') return r;
        switch (r.type) {
          case 'code':
            return <code key={i}>{r.text}</code>;
          case 'strong':
            return <strong key={i}><Inline runs={r.content} /></strong>;
          case 'em':
            return <em key={i}><Inline runs={r.content} /></em>;
          case 'del':
            return <del key={i}><Inline runs={r.content} /></del>;
          case 'link':
            return r.href ? (
              <a key={i} href={r.href} target="_blank" rel="noopener noreferrer">
                <Inline runs={r.content} />
              </a>
            ) : (
              <Inline key={i} runs={r.content} />
            );
          default:
            return null;
        }
      })}
    </>
  );
}
