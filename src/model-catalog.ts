export interface ModelCatalogSource {
  command: string;
  customModelsFile?: string;
  notes: string;
}

export interface ModelCatalogSelectionPolicy {
  mode: "llm-assigned";
  instruction: string;
  mustUseAvailableModelsOnly: boolean;
  fallbackBehavior: string;
}

export interface ModelCatalogScenarioTemplate {
  description: string;
  preferredModels: string[];
  selectionHints: string[];
}

export interface ModelCatalogModel {
  /** Canonical Pi model argument: provider/model. */
  id: string;
  provider: string;
  model: string;
  contextWindowTokens: number;
  maxOutputTokens: number;
  reasoning: boolean;
  images: boolean;
  /** Human/planner guidance, not a runtime constraint. */
  relativeStrength: string;
  /** Human/planner guidance, not runtime billing truth. */
  costTier: string;
  /** Human/planner guidance, not runtime latency truth. */
  speedTier: string;
  recommendedFor: string[];
  avoidFor: string[];
  notes: string;
}

export interface ModelCatalog {
  version: 1;
  name: string;
  capturedAt: string;
  source: ModelCatalogSource;
  selectionPolicy: ModelCatalogSelectionPolicy;
  scenarioTemplates: Record<string, ModelCatalogScenarioTemplate>;
  models: ModelCatalogModel[];
}

export function parseModelCatalogContent(content: string): ModelCatalog {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error(`Invalid model catalog JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  return parseModelCatalogDocument(parsed);
}

export function parseModelCatalogDocument(input: unknown): ModelCatalog {
  if (!isRecord(input)) throw new Error("Invalid model catalog: root must be an object");
  if (input.version !== 1) throw new Error("Invalid model catalog: version must be 1");
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

function parseSource(input: unknown, path: string): ModelCatalogSource {
  if (!isRecord(input)) throw new Error(`Invalid model catalog: ${path} must be an object`);
  const source: ModelCatalogSource = {
    command: requireNonEmptyString(input.command, `${path}.command`),
    notes: requireNonEmptyString(input.notes, `${path}.notes`),
  };
  if (input.customModelsFile !== undefined) source.customModelsFile = requireNonEmptyString(input.customModelsFile, `${path}.customModelsFile`);
  return source;
}

function parseSelectionPolicy(input: unknown, path: string): ModelCatalogSelectionPolicy {
  if (!isRecord(input)) throw new Error(`Invalid model catalog: ${path} must be an object`);
  if (input.mode !== "llm-assigned") throw new Error(`Invalid model catalog: ${path}.mode must be llm-assigned`);
  return {
    mode: "llm-assigned",
    instruction: requireNonEmptyString(input.instruction, `${path}.instruction`),
    mustUseAvailableModelsOnly: requireBoolean(input.mustUseAvailableModelsOnly, `${path}.mustUseAvailableModelsOnly`),
    fallbackBehavior: requireNonEmptyString(input.fallbackBehavior, `${path}.fallbackBehavior`),
  };
}

function parseScenarioTemplates(input: unknown, path: string): Record<string, ModelCatalogScenarioTemplate> {
  if (!isRecord(input)) throw new Error(`Invalid model catalog: ${path} must be an object`);
  const out: Record<string, ModelCatalogScenarioTemplate> = {};
  for (const [id, value] of Object.entries(input)) {
    if (!isRecord(value)) throw new Error(`Invalid model catalog: ${path}.${id} must be an object`);
    out[id] = {
      description: requireNonEmptyString(value.description, `${path}.${id}.description`),
      preferredModels: requireStringArray(value.preferredModels, `${path}.${id}.preferredModels`, { minItems: 1 }),
      selectionHints: requireStringArray(value.selectionHints, `${path}.${id}.selectionHints`),
    };
  }
  if (Object.keys(out).length === 0) throw new Error(`Invalid model catalog: ${path} must not be empty`);
  return out;
}

function parseModel(input: unknown, path: string): ModelCatalogModel {
  if (!isRecord(input)) throw new Error(`Invalid model catalog: ${path} must be an object`);
  const provider = requireNonEmptyString(input.provider, `${path}.provider`);
  const model = requireNonEmptyString(input.model, `${path}.model`);
  const id = requireNonEmptyString(input.id, `${path}.id`);
  const expectedId = `${provider}/${model}`;
  if (id !== expectedId) throw new Error(`Invalid model catalog: ${path}.id must equal provider/model (${expectedId})`);
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

function assertUniqueModels(models: ModelCatalogModel[]): void {
  const seen = new Set<string>();
  for (const model of models) {
    if (seen.has(model.id)) throw new Error(`Invalid model catalog: duplicate model id ${model.id}`);
    seen.add(model.id);
  }
}

function assertScenarioTemplatePreferredModelsExist(
  scenarioTemplates: Record<string, ModelCatalogScenarioTemplate>,
  models: ModelCatalogModel[],
): void {
  const available = new Set(models.map((model) => model.id));
  for (const [scenarioId, template] of Object.entries(scenarioTemplates)) {
    for (const preferredModel of template.preferredModels) {
      if (!available.has(preferredModel)) {
        throw new Error(`Invalid model catalog: scenarioTemplates.${scenarioId}.preferredModels references missing model ${preferredModel}`);
      }
    }
  }
}

function requireNonEmptyString(input: unknown, path: string): string {
  if (typeof input !== "string" || !input.trim()) throw new Error(`Invalid model catalog: ${path} must be a non-empty string`);
  return input.trim();
}

function requireStringArray(input: unknown, path: string, options: { minItems?: number } = {}): string[] {
  if (!Array.isArray(input)) throw new Error(`Invalid model catalog: ${path} must be an array`);
  const values = input.map((item, index) => requireNonEmptyString(item, `${path}[${index}]`));
  if (options.minItems !== undefined && values.length < options.minItems) throw new Error(`Invalid model catalog: ${path} must contain at least ${options.minItems} item(s)`);
  return values;
}

function requirePositiveInteger(input: unknown, path: string): number {
  if (!Number.isInteger(input) || (input as number) <= 0) throw new Error(`Invalid model catalog: ${path} must be a positive integer`);
  return input as number;
}

function requireBoolean(input: unknown, path: string): boolean {
  if (typeof input !== "boolean") throw new Error(`Invalid model catalog: ${path} must be a boolean`);
  return input;
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === "object" && !Array.isArray(input);
}
