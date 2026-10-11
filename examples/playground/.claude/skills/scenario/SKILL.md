---
name: scenario
description: Turn a plain-English scenario into a run that uses the playground's agents, such as "three writers in parallel, then the judge picks the best". Use when the user describes a flow they want to see in rungraph.
argument-hint: "<describe the flow you want>"
---

The user has described a flow: $ARGUMENTS

Build it from these pieces only.

**Agents** (in `.claude/agents/`):

| Agent | Does |
|---|---|
| writer | Writes a blurb and replies with it |
| judge | Scores a blurb, returns PASS or FAIL |
| researcher | Reads customer reviews |
| tone-critic, facts-critic, length-critic | Each reviews one aspect of a blurb |
| editor | Applies notes and replies with the final blurb |
| team-lead | Calls its own writer, then judge (an agent that calls agents) |

If `.claude/agents/` holds other agents, read their descriptions and use them too.

**Tools** (in `tools/`): `word-count.sh` (blurb on stdin), `check-fridge.sh` (fails until fixed), `print-sign.sh` (always fails).

**Patterns:**
- **Sequential:** start each agent only after the previous one replies.
- **Parallel or fan-out:** launch the agents in a single message so they run at the same time.
- **Fan-in:** pass every parallel result to one agent, such as editor or judge.
- **Loop:** repeat until a condition holds. Never more than 3 rounds.
- **Ask the human:** use the AskUserQuestion tool.
- **Nested:** give work to a team-lead, which calls its own writer and judge.

**Rules:**
1. Before starting, tell the user the plan in one line, such as "writer ×3 in parallel, then judge".
2. Pass every result between agents as text in their prompts, never through files, so the whole conversation shows in rungraph.
3. Keep it small. Use 8 agent calls at most unless the user asks for more.
4. If the request needs something the pieces cannot do, say so and run the closest version.
5. Finish by telling the user to look at the run in rungraph.
