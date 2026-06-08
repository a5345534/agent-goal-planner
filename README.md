# agent-goal-planner

Plan [Goal DAG](https://github.com/a5345534/agent-goal-runtime) files from
development documents for the [`agent-goal-runtime`](https://github.com/a5345534/agent-goal-runtime).

The runtime accepts a strict JSON DAG file via `/goal --dag <path>`. Writing
that JSON by hand is error-prone (kebab-case ids, acyclic dependencies,
model-scenario referential integrity, etc.). This package adds a thin
**planner layer** on top of the runtime:

- A programmatic `GoalDagSpec` builder API.
- A small CLI: `agent-goal-planner build-dag --spec <in> --out <out>`.
- A Pi skill (`/skill:goal-planner`) that teaches an agent to extract a
  spec from a PRD, design doc, or OpenSpec change, assign models from
  a catalog, and emit a valid DAG file.

The runtime stays the source of truth for the DAG schema and validation.
This package only does two things:

1. Reads a spec (which the agent or a script produces).
2. Composes a draft DAG file from the spec and round-trips it through
   `agent-goal-runtime`'s `parseGoalDagFileDocument()` — the runtime
   parser is the single source of truth for id pattern, dependency
   existence, self-dependency, cycle, and model-scenario referential
   integrity. The planner refuses to write an invalid DAG.

## Install

Install via Pi (matches the runtime package's pattern):

```bash
pi install git:github.com/a5345534/agent-goal-planner
```

The runtime dependency is pinned via the planner's own `package.json`
to `github:a5345534/agent-goal-runtime#v0.1.5`, so a single install
brings in the whole stack.

For a local-development checkout:

```bash
git clone https://github.com/a5345534/agent-goal-planner
cd agent-goal-planner
npm install      # devDeps only
npm run build
```

Then add the local path to `~/.pi/agent/settings.json` (or project
`.pi/settings.json`):

```json
{
  "packages": ["/absolute/path/to/agent-goal-planner"]
}
```

## CLI

```bash
# 1. Write a spec.json (the agent fills this in via the /skill:goal-planner workflow)
# 2. Build a validated DAG file:
npx agent-goal-planner build-dag --spec spec.json --out goal.dag.json
# 3. Hand it to the runtime:
/goal --dag goal.dag.json
```

The CLI is a thin wrapper over `buildGoalDagFromSpecFile()` from
`agent-goal-planner`'s public API.

## Programmatic API

```ts
import {
  parseGoalDagSpec,
  buildGoalDagFromSpec,
  serializeGoalDagDocument,
  validateGoalDagJson,
  type GoalDagSpec,
} from "agent-goal-planner";

const spec: GoalDagSpec = {
  objective: "Ship the People Frappe backend slices",
  nodes: [
    {
      id: "attendance-parity",
      objective: "Add attendance parity fixtures",
      workspace: { worktreeSlug: "attendance-parity" },
      outputs: ["tests/test_attendance_parity.py"],
    },
    { id: "payroll-doctypes",  objective: "Add payroll DocTypes" },
    {
      id: "integration-validation",
      objective: "Run integrated validation",
      after: ["attendance-parity", "payroll-doctypes"],
    },
  ],
};

const document = buildGoalDagFromSpec(spec);          // throws on invalid spec
const json = serializeGoalDagDocument(document);      // pretty JSON
const reparsed = validateGoalDagJson(json);           // smoke check
```

For native-git nodes, the builder emits `workspace.worktreeSlug = node.id` when
omitted. Expected `outputs` are emitted relative to that node workspace root; do
not put `.worktrees/<slug>/...` in artifact paths.

## Pi skill

The skill lives at `skills/goal-planner/SKILL.md` and ships in the npm
tarball. Once installed, the agent can run:

```text
/skill:goal-planner .goal/people-frappe-prd.md
```

The skill walks the agent through:

1. Reading the document.
2. Reading the active model catalog (`.goal/model-catalog.json` when present,
   otherwise `catalogs/pi-available-models.json`).
3. Asking clarifying questions about dependencies, conflicts, validators, and
   model assignment.
4. Producing a model assignment table and writing `modelRouting` + per-node
   `modelScenario` into the `GoalDagSpec`.
5. Writing the `GoalDagSpec` JSON.
6. Running the CLI to build a parser-valid DAG file.
7. Showing the user the resulting DAG and offering
   `/goal --dag <out.dag.json>`.

## Model catalog

The package ships a default Pi model catalog at
[`catalogs/pi-available-models.json`](catalogs/pi-available-models.json),
generated from `pi --list-models` plus `~/.pi/agent/models.json`. It lists the
available Pi model ids, context/output limits, reasoning/image support, and
planner guidance (`recommendedFor`, `avoidFor`, `costTier`, `speedTier`, notes).

Project-specific overrides should live at `.goal/model-catalog.json`. The skill
prefers that file when it exists. The catalog's role is to inform LLM judgment;
the LLM still chooses the final per-node `modelScenario` assignments and must
show a model assignment table before writing the DAG.

Schema: [`schemas/model-catalog.schema.json`](schemas/model-catalog.schema.json).

## Architecture

See [`docs/architecture-decision.md`](docs/architecture-decision.md) for
the rationale behind splitting this planner out of `agent-goal-runtime`
and the runtime API surface the planner depends on.

```
┌────────────────────────────────────────┐
│  agent-goal-runtime                    │
│  - parseGoalDagFileDocument (parser)   │
│  - GoalDagFileDocument / types         │
└────────────────────────────────────────┘
                  ▲
                  │ uses
                  │
┌────────────────────────────────────────┐
│  agent-goal-planner (this package)     │
│  - parseGoalDagSpec (loose spec JSON)  │
│  - buildGoalDagFromSpec (delegates)    │
│  - CLI: build-dag                      │
│  - Pi skill: goal-planner              │
└────────────────────────────────────────┘
```

The runtime owns the schema and validation. The planner owns the
"how do I extract a plan from a document" prompt / script / agentic
workflow. New planners (Linear tickets, Jira epics, OpenSpec changes)
can ship as additional skills or scripts under this package without
touching the runtime.

## Development

```bash
npm install
npm run check   # build + tests
```

### Build artifact policy

`dist/` is **committed to the repo**, not gitignored. The runtime
package does the same. The reason: `pi install` runs
`npm install --omit=dev`, which means `tsc` is not on PATH during
install — any `prepare` hook that tries to build will fail with
`sh: 1: tsc: not found`. Shipping a pre-built `dist/` makes the
package install-anywhere.

**When you change `src/`, you must also rebuild `dist/` and commit
the regenerated build output** — otherwise the published package
will still ship the old compiled code:

```bash
npm run check   # builds + runs tests
git add src/ dist/
git commit
```

The `prepack` script still rebuilds on `npm pack` / `npm publish`
to catch stale artifacts at release time.

### Runtime dependency

The package depends on `agent-goal-runtime` via a git ref:

```json
"agent-goal-runtime": "github:a5345534/agent-goal-runtime#v0.1.1"
```

Pin to a tag (or a commit) so planner releases are reproducible. The
runtime API surface the planner depends on:

- `parseGoalDagFileDocument` (parser + validator)
- `GoalDagFileDocument`, `GoalDagFileNode`, `GoalDagFileDefaults`,
  `GoalDagConflictHints`, `GoalDagNode`, `GoalModelRoutingConfig` types.
