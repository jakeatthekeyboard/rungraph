---
description: "Fan-out and fan-in pattern: three critics review in parallel, then an editor merges their notes."
---

Pass the blurb and notes between agents as text in their prompts. Do not use files.

1. Use the **writer** agent to write a blurb.
2. **Fan out.** Launch the **tone-critic**, **facts-critic** and **length-critic** agents in a single message, so they run in parallel. Paste the blurb text into each prompt.
3. **Fan in.** When all three have replied, paste the blurb and all their notes into the **editor** agent's prompt.
4. Show the user the editor's final blurb.
