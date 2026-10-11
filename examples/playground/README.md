# rungraph playground

A tiny pretend lemonade stand with a team of small AI agents.
Each demo command makes the agents work in a different pattern, so you can watch it in rungraph.

**Start Claude in this folder**, not the repo root. The demo commands (`/pipeline`, `/panel`, `/risky` and the rest) only load from here:

```
cd examples/playground
claude
```

Then type `/playground-guide` for the walkthrough.
For `/risky`, start plain `claude` without `--dangerously-skip-permissions`, so there is a prompt to deny.
