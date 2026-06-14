# Planning quality reference

This reference adapts planning patterns from:

- `open-multi-agent/open-multi-agent`: goal-first coordinator, `planOnly` review/replay, consensus/judge verification, phase-aware model routing, specialized parallel reviewers, structured-output retries, and observability.
- `zsq259/Plan-over-Graph`: two-stage workflow of narrative extraction → abstract transition graph → parallel schedule; rule/source-target validation; critical-path/makespan optimization; cost/risk tie-breaks; retry on invalid plans.

The runtime DAG format remains unchanged. `GoalDagSpec` may carry spec-only planning metadata that `goal-dag` strips from the runtime DAG and preserves in a trace sidecar. Use this reference to improve the **agent-side extraction and review process** before writing `GoalDagSpec` JSON.

## Quality loop

Before writing the final spec, run this loop and encode the durable results in spec-only `consumes`, `produces`, `evidence`, `modelRationale`, and `openQuestions` fields. These fields are allowed in `GoalDagSpec`, stripped from the runtime DAG JSON, and emitted to the planning trace sidecar.

### 1. Evidence table

Extract only what the source document supports.

| item | kind | evidence | implied artifact / state | ambiguity |
| --- | --- | --- | --- | --- |
| requirement / milestone / constraint | deliverable / dependency / validator / risk / model hint | quote or section reference | file, module, capability, decision, or state produced/needed | question to ask, if any |

Rules:

- Quote or point to the source section for every dependency, validator, and output.
- If an item has no evidence, omit it or ask a clarifying question.
- Distinguish **ordering language** ("after", "depends on", "then") from simple list order.

### 2. Abstract transition graph

Convert the document into an intermediate graph similar to Plan-over-Graph rules:

```json
{
  "initialState": ["current repo state", "known inputs"],
  "targetState": "accepted final outcome",
  "rules": [
    {
      "id": "r1",
      "source": ["prerequisite artifact/state"],
      "target": ["produced artifact/state"],
      "work": "candidate node objective",
      "evidence": "quote/section",
      "effort": "small|medium|large|unknown",
      "risk": "low|medium|high",
      "cost": "cheap|normal|expensive|unknown"
    }
  ]
}
```

Use this graph to reason; encode selected rule sources/targets as node `consumes` and `produces` in the final `GoalDagSpec`.

### 3. Plan over the graph

Choose DAG nodes and `after` edges by these priorities:

1. **Soundness**: every node objective is backed by a rule/evidence item.
2. **Completeness**: the selected nodes cover the target state and required validators.
3. **Parallelism**: leave independent rules parallel; only add `after` when a produced state is required by a later node.
4. **Critical path**: minimize the longest dependency chain. Prefer a small fan-in validation/audit node over serializing independent implementation nodes.
5. **Risk/cost tie-breaks**: when two plans are equivalent, prefer lower risk/cost and fewer redundant nodes.
6. **No redundant shortcuts**: omit optional nodes that do not improve the target outcome, unless the source document explicitly requires them.

### 4. Dependency and critical-path review

Show a review table before writing the spec:

| node | consumes / needs | produces | `after` | why not parallel? | risk | validator / gate |
| --- | --- | --- | --- | --- | --- | --- |

Then check:

- Every dependency supplies a required consumed state.
- Every consumed state is either in `initialState` or produced by an upstream node.
- Nodes with no dependency reason have no `after` edge.
- The graph has no orphan required outputs and no unreachable final validation.
- The critical path is explicit; long chains are justified.
- High-risk fan-in or final-audit work uses a strong/reasoning model scenario.

### 5. Judge / consensus pass for non-trivial plans

For high-risk plans, plans with more than 6 nodes, or plans with ambiguous dependencies, run a skeptical review pass before building the DAG:

- Reviewer prompt: "Find missing dependencies, invented dependencies, redundant nodes, missing validators, weak model assignments, and critical-path bottlenecks. Accept only if every edge has source evidence."
- Revise once when the reviewer finds concrete issues.
- If disagreement remains, ask the user instead of guessing.

This mirrors Open Multi-Agent's consensus pattern, but can be done manually by the Pi agent or with a stronger model scenario.

## Model-routing implications

- Use a strong/long-context model for the extraction + planning review when the document is long or ambiguous.
- Use cheaper/faster models for low-risk leaf nodes with narrow scope.
- Use stronger models for final synthesis, audits, migrations, security-sensitive work, and high fan-in integration nodes.
- Prefer explicit per-node `modelScenario` values so the reviewed plan is replayable and diffable.

## Runtime encoding

Encode only supported runtime fields:

- Dependency reasoning → `after` edges in the runtime DAG, with `consumes` / `produces` preserved only in the trace.
- Artifacts → `outputs`.
- Deterministic checks → `validators`.
- Parallelism / serialization hints → minimal `after` plus `conflicts`.
- Risk/model choice → `risk`, `modelRouting`, and per-node `modelScenario`, with `modelRationale` preserved only in the trace.
- Evidence and unresolved ambiguity → `evidence` and `openQuestions` preserved only in the trace.
- Human review requirements → `completionGates` when supported by the runtime policy.

Always build with `--trace <out.trace.json>` for non-trivial DAGs and show trace warnings/open questions before starting `/goal --dag`.
