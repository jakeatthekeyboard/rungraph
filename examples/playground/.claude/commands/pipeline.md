---
description: "Sequential pattern: researcher, then writer, then judge. Each step waits for the one before."
---

Run these steps one at a time. Wait for each to finish before starting the next.

1. Use the **researcher** agent to read the customer reviews.
2. Use the **writer** agent to write a blurb to `out/blurb.md`. Pass it the researcher's "Customers love" list.
3. Use the **judge** agent to score `out/blurb.md`.
4. Tell the user the verdict and show the final blurb.

Do not loop. One pass only, whatever the verdict.
