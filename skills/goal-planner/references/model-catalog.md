# Model catalog workflow

`agent-goal-planner` uses a model catalog so the LLM can choose models with
judgment instead of relying on hard-coded heuristics.

Default catalog:

- Package: `catalogs/pi-available-models.json`
- Project override: `.goal/model-catalog.json` (prefer this when present)
- Schema: `schemas/model-catalog.schema.json`

The catalog was generated from:

```bash
pi --list-models
```

and, where present, Pi's custom model config:

```bash
~/.pi/agent/models.json
```

## Required agent behavior

Before writing the final `GoalDagSpec`, read the active model catalog and produce
a model assignment table:

| node | risk/scope summary | chosen scenario | model | reason |
| --- | --- | --- | --- | --- |

Rules:

1. Use only models from the catalog unless the user explicitly supplies another model.
2. Prefer explicit per-node `modelScenario` over broad fuzzy rules.
3. Declare every chosen model under `modelRouting.scenarios`.
4. Set `modelRouting.controllerScenario` and `defaultSubagentScenario`.
5. Warn the user if a node would otherwise fall back to the current Pi session model.
6. For high-risk implementation/refactor work, prefer strong coding models.
7. For docs/spec-only low-risk work, prefer lower-cost/faster models.
8. For final audits or broad cross-module analysis, prefer long-context/review models.
9. For image input, choose only models where `images: true`.
10. For local/private work, only choose local models when risk is acceptable or user requests it.

## Scenario templates in the default catalog

The default catalog includes these scenario templates. The LLM may rename or
omit scenarios when the assignment table justifies it, but should start here:

| scenario | typical purpose |
| --- | --- |
| `controller` | Long-horizon orchestration decisions |
| `implementation` | High/medium-risk coding, tests, refactors |
| `review` | Architecture review, audit, validation |
| `long-context-audit` | Very large context reading / repo-wide audit |
| `docs` | Specs, docs, tasks.md, low-risk text edits |
| `fast-simple` | Low-risk mechanical edits where speed matters |
| `local-private` | Local/zero-remote-cost tasks where quality risk is acceptable |

## Recommended starting assignments

Use the catalog's `recommendedFor`, `avoidFor`, `costTier`, `speedTier`,
`contextWindowTokens`, `images`, and `notes` fields to justify assignment.

Typical choices for this Pi installation:

- Controller / high-risk implementation: `openai-codex/gpt-5.5`
- Strong implementation fallback: `openai-codex/gpt-5.4`
- Docs/spec-only low-risk: `openai-codex/gpt-5.4-mini` or `openai-codex/gpt-5.3-codex-spark`
- Long-context audit/review: `deepseek/deepseek-v4-pro`
- Fast long-context scan: `deepseek/deepseek-v4-flash`
- Fast low-risk docs/analysis: `minimax/MiniMax-M2.7-highspeed`
- Local/private low-risk: `local-aeon/aeon`

## Example modelRouting block

```json
{
  "modelRouting": {
    "scenarios": {
      "controller": {
        "model": "openai-codex/gpt-5.5",
        "description": "Long-horizon supervision"
      },
      "implementation": {
        "model": "openai-codex/gpt-5.5",
        "description": "High-risk coding/refactor work"
      },
      "docs": {
        "model": "openai-codex/gpt-5.4-mini",
        "description": "Docs/spec-only low-risk work"
      },
      "review": {
        "model": "deepseek/deepseek-v4-pro",
        "description": "Long-context audit/review work"
      }
    },
    "controllerScenario": "controller",
    "defaultSubagentScenario": "implementation"
  },
  "nodes": [
    { "id": "move-payroll", "objective": "Move payroll entities", "risk": "high", "modelScenario": "implementation" },
    { "id": "update-spec", "objective": "Update spec table", "risk": "low", "modelScenario": "docs" },
    { "id": "final-audit", "objective": "Run final audit", "risk": "medium", "modelScenario": "review" }
  ]
}
```
