---
description: "Permission-denial demo: the agent asks to delete the out/ folder. Click No to see a denial in the graph."
---

1. List what is in `out/` with Bash.
2. Run `rm -r out/*` with Bash to clear it. The user is expected to deny this.
3. If the command is denied, reply "Okay, I'll leave the folder alone." and stop.
   Do not try another way to delete anything.
