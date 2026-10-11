---
name: playground-guide
description: Explains the rungraph playground to someone who has just cloned the repo. Covers what is in it, how to start it, the demo commands and what each one shows in the graph. Use when the user asks how the playground works, how to get started, or what to try.
---

Explain the playground to the user using the guide below. Start with the "Quick start" section.
Then ask what they would like to try. If they are already inside `examples/playground`, offer to run one of the commands for them.
Keep your answer short. Show the tables as they are.

# The rungraph playground

A tiny pretend business, **Sunny's Lemonade Stand**, with a team of small AI agents that write and review ads for it.
Each demo command makes the agents work together in a different pattern. You then open rungraph and see that pattern as a graph.

## Quick start

From the repo root, in one terminal:

```
npm install
npm run build
node bin/rungraph.js --project examples/playground
```

That opens the rungraph dashboard in your browser, showing only playground runs.

In a second terminal:

```
cd examples/playground
claude
```

Then type a command such as `/pipeline`. Watch the graph grow in the browser while it runs.

## The demo commands

| Command | Pattern | What to look for in the graph |
|---|---|---|
| `/pipeline` | Sequential | Three agents in a straight line, one after another |
| `/panel` | Fan-out, fan-in | Three critics side by side, joining into the editor |
| `/until-good` | Loop with AI judge | Writer and judge repeating until PASS |
| `/flaky` | Retry storm | A Bash step that failed three times, flagged in the signal strip |
| `/ask-me` | Human in the loop | A question node showing your answer |
| `/risky` | Permission denial | A "denied" node, after you click No |
| `/broken` | Unresolved error | An error that nothing fixed, flagged in the signal strip |
| `/nested` | Nested fan-out | Two team leads side by side, each with its own writer and judge under it |
| `/scenario <your idea>` | Anything you describe | Whatever shape you asked for |

Try `/scenario` with things like:
- "three writers in parallel, then the judge picks the best"
- "researcher first, then writer and judge in a loop"

More ideas are in `SCENARIOS.md`.

## What is in the folder

| Folder | Holds |
|---|---|
| `.claude/agents/` | The eight agents: writer, judge, researcher, three critics, editor, team-lead |
| `.claude/commands/` | The demo commands above |
| `.claude/skills/` | `scenario` and this guide |
| `data/` | The stand's facts and three customer reviews |
| `tools/` | Small shell scripts the agents run |
| `out/` | Where blurbs get saved. Git ignores it, so you can delete it any time |

Every file is short plain Markdown or shell. Open any of them to see how it works, or copy one to make your own agent.

## Things to know

- **`/risky` needs permission prompts.** If you started Claude with `--dangerously-skip-permissions`, there is no prompt to deny, so no denial node appears. Start plain `claude` for this one.
- **Cost is small.** The agents run on Haiku, the cheapest Claude model. A full `/panel` run is a few cents.
- **Starting fresh.** Delete the files in `out/` to reset. Old runs stay in rungraph, which is the point.
