---
description: "Loop pattern with AI-as-judge: writer and judge go round until the judge says PASS. Max 3 rounds."
---

This demo deliberately fails round 1 so you can see the loop in the graph.
Pass the blurb between agents as text in their prompts. Do not use files.

- **Round 1:** use the **writer** agent and tell it to write a long blurb of about 90 words. Then paste that blurb into the **judge** agent's prompt.
- **Each later round:** if the verdict was FAIL, give the **writer** agent the previous blurb and the judge's "Fix" line, and ask for a new version within 60 words. Then paste the new blurb into the **judge** agent's prompt again.
- **Stop** as soon as the verdict is PASS, or after 3 rounds.

Finish by telling the user how many rounds it took and showing the final blurb.
