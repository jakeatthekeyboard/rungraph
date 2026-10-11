---
description: "Sequential pattern: researcher, then writer, then judge. Each step waits for the one before."
---

Run these steps one at a time. Wait for each to finish before starting the next.
Pass results between agents as text in their prompts. Do not use files.

1. Use the **researcher** agent to read the customer reviews.
2. Use the **writer** agent to write a blurb. Paste the researcher's "Customers love" list into its prompt.
3. Use the **judge** agent to score the blurb. Paste the blurb text into its prompt.
4. Tell the user the verdict and show the blurb.

Do not loop. One pass only, whatever the verdict.
