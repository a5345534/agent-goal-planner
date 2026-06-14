---
name: goal-dag
description: Read a development document (PRD, OpenSpec change, design doc, ticket description) and produce a valid Goal DAG JSON file consumable by `/goal --dag`. Use when the user has a multi-step plan document and wants to drive the `agent-goal-runtime` from it instead of writing DAG JSON by hand.
---

# Goal DAG

This skill teaches the agent to convert a free-form development document into a
[Goal DAG](references/dag-format.md) JSON file that `agent-goal-runtime` can execute
via `/goal --dag <path>`.

The skill is intentionally **prompt + reference heavy, code-light**. The agent
performs the creative steps: extracting milestones from the document and assigning
models from the catalog. Deterministic code then turns the `GoalDagSpec` into a
DAG file and round-trips it through `agent-goal-runtime`'s parser for validation.

## When to load this skill

- The user has a markdown / text document describing a multi-step plan and
  wants `/goal` to execute it.
- The user wants to refactor a goal that started as a single objective into
  a multi-node DAG.
- The user wants to add a known good set of validators, expected outputs, and
  model-routing scenarios to a planned goal.

## When **not** to load this skill

- The user only has a one-liner objective → use `/goal <objective>` directly.
- The user has already written a DAG JSON file → run `/goal --dag <path>`
  directly.
- The user wants to inspect an existing goal → use `/goal status` /
  `/goal monitor`.

## Inputs

- `<doc>` — path to a development document. Supported today: markdown, plain
  text, or a JSON document that the agent can structure into a `GoalDagSpec`.
- (Optional) `<out>` — output path for the DAG file. Default: a sibling
  `.dag.json` next to the document (e.g. `prd.md` → `prd.dag.json`).
- (Optional) `<trace>` — output path for the planning trace sidecar. Default:
  a sibling `.trace.json` next to the DAG file when producing a non-trivial DAG.

## Workflow

1. **Read the document** with `read`. Do not invent content; the document is
   the source of truth for the goal objective and node list.
2. **Read the model catalog** before assigning models. Prefer a project-local
   `.goal/model-catalog.json` when present; otherwise use this package's
   [`../../catalogs/pi-available-models.json`](../../catalogs/pi-available-models.json).
   The catalog lists ordered model-routing rules for Shawn's machine. Each rule
   maps task traits (for example `taskType`, `risk`, `privacy`, and estimated
   context) to a recommended `modelScenario` and Pi model id. Use only models
   from this catalog unless the user explicitly supplies another model.
3. **Extract a `GoalDagSpec`**. Use this exact shape:

   ```ts
   interface GoalDagSpec {
     version?: 1;
     objective: string;          // one-sentence summary of the overall goal
     defaults?: { ... };         // copied to every node unless overridden; goal-dag supports defaults.risk
     modelRouting?: { ... };     // see references/routing-scenarios.md
     openQuestions?: string[];   // spec-only questions preserved in the trace sidecar
     nodes: Array<{
       id: string;               // kebab-case, ^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$
       objective: string;        // work assigned to the subagent
       after?: string[];         // node ids that must complete first
       outputs?: string[];       // expected files / dirs, workspace-root-relative (no .worktrees/...)
       validators?: string[];    // shell validators
       conflicts?: { files?: string[]; modules?: string[]; capabilities?: string[] };
       scope?: string;
       workspaceStrategy?: string;
       workspace?: { worktreeSlug?: string; branch?: string; baseRef?: string }; // deterministic node workspace binding
       risk?: "low" | "medium" | "high";
       completionGates?: string[];
       modelScenario?: string;
       consumes?: string[];      // spec-only states/artifacts required by this node
       produces?: string[];      // spec-only states/artifacts produced by this node
       evidence?: Array<string | { id?: string; source?: string; quote?: string; note?: string; supports?: string[] }>;
       modelRationale?: string;  // spec-only reason for the chosen modelScenario
     }>;
   }
   ```

   See [`references/dag-format.md`](references/dag-format.md) for the full
   field reference, [`references/routing-scenarios.md`](references/routing-scenarios.md)
   for model-routing examples, [`references/model-catalog.md`](references/model-catalog.md)
   for the model assignment workflow, and
   [`references/planning-quality.md`](references/planning-quality.md) for the
   evidence → transition graph → reviewed DAG quality loop.

4. **Run a planning-quality pass before finalizing edges.** Adapt the
   Plan-over-Graph pattern: extract an evidence table, map narrative items into
   abstract transition rules (`source` prerequisites → `target` outcomes), then
   plan over that graph for maximum safe parallelism. Encode the reviewed states
   into each node's spec-only `consumes`, `produces`, and `evidence` fields.
   Show a dependency review table with each node's consumed state, produced
   state, `after` edges, and why it cannot run in parallel. For high-risk plans,
   ambiguous dependency graphs, or >6 nodes, run a skeptical judge/consensus
   pass inspired by Open Multi-Agent: find missing dependencies, invented
   dependencies, redundant nodes, missing validators, weak model assignments,
   and critical-path bottlenecks. Revise once, then ask the user when evidence
   is still unclear.

5. **Assign models with LLM judgment using the catalog.** Produce and show a
   table before writing the final spec:

   | node | risk/scope summary | chosen scenario | model | reason |
   | --- | --- | --- | --- | --- |

   Then write `modelRouting.scenarios`, explicit per-node `modelScenario`
   values, and per-node `modelRationale` into the spec. Prefer explicit
   per-node assignments over fuzzy rules; use runtime `modelRouting.rules` only
   when a rule is simpler and less ambiguous. If all nodes would otherwise fall
   back to the current Pi session model, warn the user and ask whether that is
   intended.

6. **Ask clarifying questions** when the document is ambiguous:
   - Are nodes A and B parallel, or does B depend on A?
   - Which modules / files does each node touch? (drives `conflicts`)
   - Is there a verification command per node? (drives `validators`)
   - What state/artifact does each dependency consume and produce?
   - Is a shortcut/optional node required, or should it be omitted as redundant?
   - Should a node use a different model? (drives `modelScenario`)
   - Is a cheaper/faster model acceptable for low-risk docs/spec-only nodes?
   - Does a high-risk or final-audit node require a stronger/long-context model?

7. **Write the spec to a temp JSON file** and run:

   ```bash
   npx --package=goal-dag goal-dag build-dag \
     --spec <spec.json> --out <out.dag.json> --trace <out.trace.json>
   ```

   The CLI round-trips the spec through `agent-goal-runtime`'s
   `parseGoalDagFileDocument()` and refuses to write an invalid DAG. Spec-only
   `consumes`, `produces`, `evidence`, and `modelRationale` fields are stripped
   from the runtime DAG and preserved in the trace sidecar. For native-git nodes,
   it emits `workspace.worktreeSlug` when omitted and normalizes matching
   `.worktrees/<slug>/...` outputs to workspace-root-relative paths.

8. **Show the user the resulting DAG and trace** (objective + node ids +
   dependency graph + dependency review + model assignment table + trace warnings
   / open questions) and the diff vs. the document's intent, then ask whether to
   start:

   ```text
   /goal --dag <out.dag.json>
   ```

## Hard rules

- **Do not invent sequential dependencies.** Nodes with no `after` array are
  runnable in parallel. If the document explicitly says "step 1, then step 2,
  then step 3", wire those as `after`; if it just lists items, leave them
  independent.
- **Do not invent `validators` or `outputs` the document does not support.**
  The runtime will run validators as plain shell commands; only include them
  when the document specifies the check. Otherwise omit the field. Outputs must
  be relative to the node workspace root; if you need a deterministic worktree
  name, set `workspace.worktreeSlug` instead of prefixing outputs with
  `.worktrees/...`.
- **Do not use models outside the active model catalog.** Declare every chosen
  model in `modelRouting.scenarios`, then assign each node with `modelScenario`.
  Omit `modelScenario` only after warning the user that runtime fallback will
  use `defaultSubagentScenario` or the current Pi session model.
- **Every `after` edge needs evidence.** Before writing the spec, be able to
  explain what upstream state/artifact the dependent node consumes. Encode that
  state in `consumes` / `produces` and cite the source in `evidence`. If the edge
  is only based on list order or habit, remove it or ask the user.
- **Always round-trip through the runtime parser** so cycle / missing-dep /
  scenario-ref errors surface before the user sees the file.

## Failure modes

- The document is a one-line objective. Stop and tell the user to use
  `/goal <objective>` instead.
- The document is too long (>20 nodes). Tell the user the default cap and
  ask whether to chunk the work into multiple goals.
- The validator list is non-deterministic (e.g. reads from CI variables).
  Reject the spec and ask for a deterministic command.
