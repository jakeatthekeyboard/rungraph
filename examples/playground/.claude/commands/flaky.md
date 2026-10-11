---
description: "Retry-storm demo: a fridge check fails three times before the agent reads the help file and fixes it."
---

This demo plays an impatient agent so the graph shows a retry storm.
Follow these steps exactly and do not skip ahead.

1. Use the Write tool to write the single word `warm` into `out/fridge.txt`.
2. Run `tools/check-fridge.sh` with Bash. It will fail.
3. Run `tools/check-fridge.sh` again straight away, without changing anything. It will fail.
4. Run it a third time straight away. It will fail again.
5. Now read the file the error message points to.
6. Do what the help file says, using the Write tool.
7. Run `tools/check-fridge.sh` once more. It should pass.
8. Tell the user what went wrong and how it was fixed.
