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
export declare function parseModelCatalogContent(content: string): ModelCatalog;
export declare function parseModelCatalogDocument(input: unknown): ModelCatalog;
