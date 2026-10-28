import { AsyncLocalStorage } from 'node:async_hooks';

// The detail payloads cap long text (prompts, responses, tool output) so a
// node click stays fast; each adapter's cap() appends "… (N more chars)".
// The inspector's "show full" asks for the same detail without the cap: the
// server re-parses the run inside withoutCaps(), and every cap() in that
// async call tree returns its text whole. Scoped per call, so a concurrent
// ordinary parse in the same process keeps its caps.

const lifted = new AsyncLocalStorage();

/** Run fn with every adapter's text cap lifted for its whole async call tree. */
export function withoutCaps(fn) {
  return lifted.run(true, fn);
}

/** True inside withoutCaps(). */
export function capsLifted() {
  return lifted.getStore() === true;
}
