---
description: "Fan-out and fan-in pattern: three critics review in parallel, then an editor merges their notes."
---

1. If `out/blurb.md` does not exist, use the **writer** agent to create it first.
2. **Fan out.** Launch the **tone-critic**, **facts-critic** and **length-critic** agents in a single message, so they run in parallel. Do not wait for one before starting the next.
3. **Fan in.** When all three have replied, pass all their notes to the **editor** agent.
4. Show the user the final blurb from `out/blurb-final.md`.
