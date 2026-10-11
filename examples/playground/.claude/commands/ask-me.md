---
description: "Human-in-the-loop demo: the agent asks you which flavour to feature, then writes a blurb about it."
---

1. Use the AskUserQuestion tool to ask the user which flavour to feature this weekend.
   Offer these options: Classic, Strawberry, and Mint (a new idea, not on the menu yet).
2. Use the **writer** agent to write `out/blurb.md` featuring the flavour the user picked.
   If they picked Mint, tell the writer to call it "coming soon".
3. Show the user the blurb.
