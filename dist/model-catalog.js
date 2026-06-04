export function parseModelCatalogContent(content) {
    let parsed;
    try {
        parsed = JSON.parse(content);
    }
    catch (error) {
        throw new Error(`Invalid model catalog JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
    return parseModelCatalogDocument(parsed);
}
export function parseModelCatalogDocument(input) {
    if (!isRecord(input))
        throw new Error("Invalid model catalog: root must be an object");
    if (input.version !== 1)
        throw new Error("Invalid model catalog: version must be 1");
    const name = requireNonEmptyString(input.name, "name");
    const capturedAt = requireNonEmptyString(input.capturedAt, "capturedAt");
    const source = parseSource(input.source, "source");
    const selectionPolicy = parseSelectionPolicy(input.selectionPolicy, "selectionPolicy");
    const scenarioTemplates = parseScenarioTemplates(input.scenarioTemplates, "scenarioTemplates");
    if (!Array.isArray(input.models) || input.models.length === 0) {
        throw new Error("Invalid model catalog: models must be a non-empty array");
    }
    const models = input.models.map((model, index) => parseModel(model, `models[${index}]`));
    assertUniqueModels(models);
    assertScenarioTemplatePreferredModelsExist(scenarioTemplates, models);
    return { version: 1, name, capturedAt, source, selectionPolicy, scenarioTemplates, models };
}
function parseSource(input, path) {
    if (!isRecord(input))
        throw new Error(`Invalid model catalog: ${path} must be an object`);
    const source = {
        command: requireNonEmptyString(input.command, `${path}.command`),
        notes: requireNonEmptyString(input.notes, `${path}.notes`),
    };
    if (input.customModelsFile !== undefined)
        source.customModelsFile = requireNonEmptyString(input.customModelsFile, `${path}.customModelsFile`);
    return source;
}
function parseSelectionPolicy(input, path) {
    if (!isRecord(input))
        throw new Error(`Invalid model catalog: ${path} must be an object`);
    if (input.mode !== "llm-assigned")
        throw new Error(`Invalid model catalog: ${path}.mode must be llm-assigned`);
    return {
        mode: "llm-assigned",
        instruction: requireNonEmptyString(input.instruction, `${path}.instruction`),
        mustUseAvailableModelsOnly: requireBoolean(input.mustUseAvailableModelsOnly, `${path}.mustUseAvailableModelsOnly`),
        fallbackBehavior: requireNonEmptyString(input.fallbackBehavior, `${path}.fallbackBehavior`),
    };
}
function parseScenarioTemplates(input, path) {
    if (!isRecord(input))
        throw new Error(`Invalid model catalog: ${path} must be an object`);
    const out = {};
    for (const [id, value] of Object.entries(input)) {
        if (!isRecord(value))
            throw new Error(`Invalid model catalog: ${path}.${id} must be an object`);
        out[id] = {
            description: requireNonEmptyString(value.description, `${path}.${id}.description`),
            preferredModels: requireStringArray(value.preferredModels, `${path}.${id}.preferredModels`, { minItems: 1 }),
            selectionHints: requireStringArray(value.selectionHints, `${path}.${id}.selectionHints`),
        };
    }
    if (Object.keys(out).length === 0)
        throw new Error(`Invalid model catalog: ${path} must not be empty`);
    return out;
}
function parseModel(input, path) {
    if (!isRecord(input))
        throw new Error(`Invalid model catalog: ${path} must be an object`);
    const provider = requireNonEmptyString(input.provider, `${path}.provider`);
    const model = requireNonEmptyString(input.model, `${path}.model`);
    const id = requireNonEmptyString(input.id, `${path}.id`);
    const expectedId = `${provider}/${model}`;
    if (id !== expectedId)
        throw new Error(`Invalid model catalog: ${path}.id must equal provider/model (${expectedId})`);
    return {
        id,
        provider,
        model,
        contextWindowTokens: requirePositiveInteger(input.contextWindowTokens, `${path}.contextWindowTokens`),
        maxOutputTokens: requirePositiveInteger(input.maxOutputTokens, `${path}.maxOutputTokens`),
        reasoning: requireBoolean(input.reasoning, `${path}.reasoning`),
        images: requireBoolean(input.images, `${path}.images`),
        relativeStrength: requireNonEmptyString(input.relativeStrength, `${path}.relativeStrength`),
        costTier: requireNonEmptyString(input.costTier, `${path}.costTier`),
        speedTier: requireNonEmptyString(input.speedTier, `${path}.speedTier`),
        recommendedFor: requireStringArray(input.recommendedFor, `${path}.recommendedFor`),
        avoidFor: requireStringArray(input.avoidFor, `${path}.avoidFor`),
        notes: requireNonEmptyString(input.notes, `${path}.notes`),
    };
}
function assertUniqueModels(models) {
    const seen = new Set();
    for (const model of models) {
        if (seen.has(model.id))
            throw new Error(`Invalid model catalog: duplicate model id ${model.id}`);
        seen.add(model.id);
    }
}
function assertScenarioTemplatePreferredModelsExist(scenarioTemplates, models) {
    const available = new Set(models.map((model) => model.id));
    for (const [scenarioId, template] of Object.entries(scenarioTemplates)) {
        for (const preferredModel of template.preferredModels) {
            if (!available.has(preferredModel)) {
                throw new Error(`Invalid model catalog: scenarioTemplates.${scenarioId}.preferredModels references missing model ${preferredModel}`);
            }
        }
    }
}
function requireNonEmptyString(input, path) {
    if (typeof input !== "string" || !input.trim())
        throw new Error(`Invalid model catalog: ${path} must be a non-empty string`);
    return input.trim();
}
function requireStringArray(input, path, options = {}) {
    if (!Array.isArray(input))
        throw new Error(`Invalid model catalog: ${path} must be an array`);
    const values = input.map((item, index) => requireNonEmptyString(item, `${path}[${index}]`));
    if (options.minItems !== undefined && values.length < options.minItems)
        throw new Error(`Invalid model catalog: ${path} must contain at least ${options.minItems} item(s)`);
    return values;
}
function requirePositiveInteger(input, path) {
    if (!Number.isInteger(input) || input <= 0)
        throw new Error(`Invalid model catalog: ${path} must be a positive integer`);
    return input;
}
function requireBoolean(input, path) {
    if (typeof input !== "boolean")
        throw new Error(`Invalid model catalog: ${path} must be a boolean`);
    return input;
}
function isRecord(input) {
    return Boolean(input) && typeof input === "object" && !Array.isArray(input);
}
//# sourceMappingURL=model-catalog.js.map