import { readFileSync, writeFileSync } from "node:fs";
import { parseGoalDagFileDocument, } from "agent-goal-runtime";
/**
 * Parse a {@link GoalDagSpec} from a JSON string. The deep structural /
 * graph / model-scenario checks happen later in {@link buildGoalDagFromSpec}
 * when the spec is round-tripped through the runtime parser; here we just
 * confirm the shape is plumbable.
 */
export function parseGoalDagSpec(content) {
    let parsed;
    try {
        parsed = JSON.parse(content);
    }
    catch (error) {
        throw new Error(`Invalid goal DAG spec JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
    return parseGoalDagSpecDocument(parsed);
}
export function parseGoalDagSpecDocument(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new Error("Invalid goal DAG spec: root must be an object");
    }
    const record = input;
    if (typeof record.objective !== "string" || !record.objective.trim()) {
        throw new Error("Invalid goal DAG spec: objective must be a non-empty string");
    }
    if (!Array.isArray(record.nodes) || record.nodes.length === 0) {
        throw new Error("Invalid goal DAG spec: nodes must be a non-empty array");
    }
    if (record.version !== undefined && record.version !== 1) {
        throw new Error("Invalid goal DAG spec: version must be 1 when present");
    }
    return record;
}
/**
 * Build a validated {@link GoalDagFileDocument} from a spec.
 *
 * This is the producer-side counterpart to the runtime's
 * `parseGoalDagFileDocument`. We compose a draft document from the spec
 * and round-trip it through the runtime parser, which is the single
 * source of truth for id pattern, dependency existence, self-dependency,
 * cycle, and model-scenario referential-integrity rules. A failure
 * surfaces as a thrown error before the caller writes the file.
 */
export function buildGoalDagFromSpec(spec) {
    const draft = {
        version: spec.version ?? 1,
        objective: spec.objective,
        ...(spec.defaults ? { defaults: cloneDefaults(spec.defaults) } : {}),
        ...(spec.modelRouting ? { modelRouting: cloneModelRouting(spec.modelRouting) } : {}),
        nodes: spec.nodes.map(cloneNode),
    };
    return parseGoalDagFileDocument(draft);
}
/**
 * Convenience helper: read a spec file, build a validated document, write
 * a pretty-printed DAG JSON to disk, and return the document.
 */
export function buildGoalDagFromSpecFile(specPath, outPath) {
    const spec = parseGoalDagSpec(readFileSync(specPath, "utf8"));
    const document = buildGoalDagFromSpec(spec);
    writeFileSync(outPath, serializeGoalDagDocument(document), "utf8");
    return document;
}
/**
 * Serialize a {@link GoalDagFileDocument} to JSON. Pretty-printed by
 * default for human review; pass `{ pretty: false }` for compact output.
 */
export function serializeGoalDagDocument(document, options = {}) {
    return JSON.stringify(document, null, options.pretty === false ? undefined : 2);
}
/**
 * Validate a candidate JSON string as a Goal DAG document (i.e. the
 * on-disk format the runtime accepts via `/goal --dag <path>`). Useful
 * for the CLI / skill to dry-run a produced file before showing it to
 * the user.
 */
export function validateGoalDagJson(content) {
    return parseGoalDagFileDocument(JSON.parse(content));
}
function cloneNode(node) {
    const out = {
        id: node.id,
        objective: node.objective,
    };
    if (node.after)
        out.after = [...node.after];
    if (node.outputs)
        out.outputs = [...node.outputs];
    if (node.validators)
        out.validators = [...node.validators];
    if (node.conflicts)
        out.conflicts = cloneConflicts(node.conflicts);
    if (node.scope !== undefined)
        out.scope = node.scope;
    if (node.workspaceStrategy !== undefined)
        out.workspaceStrategy = node.workspaceStrategy;
    if (node.risk !== undefined)
        out.risk = node.risk;
    if (node.completionGates)
        out.completionGates = [...node.completionGates];
    if (node.modelScenario !== undefined)
        out.modelScenario = node.modelScenario;
    return out;
}
function cloneDefaults(defaults) {
    const out = {};
    if (defaults.outputs)
        out.outputs = [...defaults.outputs];
    if (defaults.validators)
        out.validators = [...defaults.validators];
    if (defaults.workspaceStrategy !== undefined)
        out.workspaceStrategy = defaults.workspaceStrategy;
    if (defaults.completionGates)
        out.completionGates = [...defaults.completionGates];
    if (defaults.conflicts)
        out.conflicts = cloneConflicts(defaults.conflicts);
    if (defaults.modelScenario !== undefined)
        out.modelScenario = defaults.modelScenario;
    return out;
}
function cloneConflicts(conflicts) {
    const out = {};
    if (conflicts.files)
        out.files = [...conflicts.files];
    if (conflicts.modules)
        out.modules = [...conflicts.modules];
    if (conflicts.capabilities)
        out.capabilities = [...conflicts.capabilities];
    return out;
}
function cloneModelRouting(config) {
    const scenarios = {};
    for (const [id, scenario] of Object.entries(config.scenarios)) {
        scenarios[id] = { ...scenario };
    }
    const out = { scenarios };
    if (config.controllerScenario)
        out.controllerScenario = config.controllerScenario;
    if (config.defaultSubagentScenario)
        out.defaultSubagentScenario = config.defaultSubagentScenario;
    if (config.rules)
        out.rules = config.rules.map((rule) => ({ ...rule }));
    return out;
}
//# sourceMappingURL=builder.js.map