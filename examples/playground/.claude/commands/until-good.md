---
description: "Loop pattern with AI-as-judge: writer and judge go round until the judge says PASS. Max 3 rounds."
---

This demo deliberately fails round 1 so you can see the loop in the graph.

- **Round 1:** use the **writer** agent and tell it to write a long blurb of about 90 words to `out/blurb.md`. Then use the **judge** agent to score it.
- **Each later round:** if the verdict was FAIL, pass the judge's "Fix" line to the **writer** agent and ask for a new version of `out/blurb.md` within 60 words. Then use the **judge** agent again.
- **Stop** as soon as the verdict is PASS, or after 3 rounds.

Finish by telling the user how many rounds it took and showing the final blurb.
