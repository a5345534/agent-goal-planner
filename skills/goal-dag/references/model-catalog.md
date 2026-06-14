# Model catalog workflow

`goal-dag` uses a model-routing catalog so the LLM can choose models with
judgment instead of relying on hard-coded heuristics.

Default catalog:

- Package: `catalogs/pi-available-models.json`
- Project override: `.goal/model-catalog.json` (prefer this when present)
- Schema: `schemas/model-catalog.schema.json`

## Catalog shape

The catalog is advisory input for the skill, not the exact runtime
`modelRouting` block. Each rule maps task traits to a recommended scenario and
Pi model id:

```json
{
  "modelRouting": {
    "defaultSubagentScenario": "spark-implementation",
    "rules": [
      {
        "when": {
          "taskType": ["isolated-patch", "small-bugfix"],
          "risk": ["low", "medium"],
          "contextTokensEstimated": "<=128000"
        },
        "modelScenario": "spark-implementation",
        "model": "openai-codex/gpt-5.3-codex-spark"
      }
    ]
  }
}
```

`when` keys are intentionally agent/LLM-facing traits. They may be richer than
the runtime's current rule matcher, so do **not** blindly copy these catalog
rules into the final DAG. Instead, use them to choose explicit per-node
`modelScenario` values, write a per-node `modelRationale`, and declare
runtime-compatible `modelRouting.scenarios`.

## Required agent behavior

Before writing the final `GoalDagSpec`, read the active model catalog and produce
a model assignment table:

| node | risk/scope summary | chosen scenario | model | reason |
| --- | --- | --- | --- | --- |

Rules:

1. Use only models from the catalog unless the user explicitly supplies another model.
2. Evaluate rules in order and prefer the first clear match.
3. Prefer explicit per-node `modelScenario` over broad fuzzy runtime rules.
4. Declare every chosen scenario under the final DAG's `modelRouting.scenarios`.
5. Write the table's reason into each node's spec-only `modelRationale` so it appears in the planning trace.
6. Set `modelRouting.defaultSubagentScenario` when a safe default is clear.
7. Warn the user if a node would otherwise fall back to the current Pi session model.
8. For long-context scans, prefer the catalog's long-context scan/reasoning scenarios.
9. For critical or final-authority decisions, prefer the strongest catalog scenario.
10. For local/private work, only choose local models when risk is acceptable or user requests it.

## Example final runtime `modelRouting` block

After using the catalog to assign scenarios, write runtime-compatible routing in
the `GoalDagSpec`:

```json
{
  "modelRouting": {
    "scenarios": {
      "spark-implementation": {
        "model": "openai-codex/gpt-5.3-codex-spark",
        "description": "Fast low/medium-risk implementation under 128K context"
      },
      "review": {
        "model": "deepseek/deepseek-v4-pro",
        "description": "Medium/high-risk review and audit"
      }
    },
    "defaultSubagentScenario": "spark-implementation"
  },
  "nodes": [
    {
      "id": "fix-lint",
      "objective": "Fix lint errors",
      "risk": "low",
      "modelScenario": "spark-implementation",
      "modelRationale": "Low-risk lint fix under 128K context"
    },
    {
      "id": "final-audit",
      "objective": "Review integration risks",
      "risk": "medium",
      "modelScenario": "review",
      "modelRationale": "Medium-risk integration review benefits from long-context reasoning"
    }
  ]
}
```
