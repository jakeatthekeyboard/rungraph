---
description: "Nested fan-out: two team leads run in parallel, and each one calls its own writer and judge."
---

This demo shows agents calling agents.

1. **Fan out.** In a single message, launch two **team-lead** agents so they run in parallel:
   - one for the style "funny", using `out/nested-funny.md`
   - one for the style "fancy", using `out/nested-fancy.md`
2. Each team lead calls its own **writer**, then its own **judge**. Do not call the writer or judge yourself.
3. When both team leads reply, tell the user each style's verdict.
