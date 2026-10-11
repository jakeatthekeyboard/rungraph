---
description: "Human-in-the-loop demo: the agent asks you which flavour to feature, then writes a blurb about it."
---

1. Use the AskUserQuestion tool to ask the user which flavour to feature this weekend.
   Offer these options: Classic, Strawberry, and Mint (a new idea, not on the menu yet).
2. Use the **writer** agent to write `out/blurb.md` featuring the flavour the user picked.
   If they picked Mint, tell the writer to call it "coming soon".
3. Show the user the blurb.
4. Tell the user where to see this run as a graph:
   - If the rungraph dashboard is already running, open http://127.0.0.1:4321 and pick this run.
   - If it is not running, start it from the repo root with
     `node bin/rungraph.js --project examples/playground`.
     The `--project` flag shows only playground runs. Without it, the dashboard lists runs from every project on this machine.
