import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseModelCatalogContent, parseModelCatalogDocument } from "../index.js";
const HERE = dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = resolve(HERE, "..", "..", "catalogs", "pi-available-models.json");
test("default Pi model catalog parses and contains all pi --list-models entries", () => {
    const catalog = parseModelCatalogContent(readFileSync(CATALOG_PATH, "utf8"));
    assert.equal(catalog.version, 1);
    assert.equal(catalog.name, "pi-available-models");
    assert.equal(catalog.selectionPolicy.mode, "llm-assigned");
    assert.equal(catalog.models.length, 17);
    const ids = new Set(catalog.models.map((model) => model.id));
    for (const id of [
        "deepseek/deepseek-v4-flash",
        "deepseek/deepseek-v4-pro",
        "local-aeon/aeon",
        "minimax/MiniMax-M2",
        "minimax/MiniMax-M2.1",
        "minimax/MiniMax-M2.1-highspeed",
        "minimax/MiniMax-M2.5",
        "minimax/MiniMax-M2.5-highspeed",
        "minimax/MiniMax-M2.7",
        "minimax/MiniMax-M2.7-highspeed",
        "minimax/MiniMax-M3",
        "openai-codex/gpt-5.2",
        "openai-codex/gpt-5.3-codex",
        "openai-codex/gpt-5.3-codex-spark",
        "openai-codex/gpt-5.4",
        "openai-codex/gpt-5.4-mini",
        "openai-codex/gpt-5.5",
    ]) {
        assert.ok(ids.has(id), `missing ${id}`);
    }
});
test("default Pi model catalog scenario templates reference existing models", () => {
    const catalog = parseModelCatalogContent(readFileSync(CATALOG_PATH, "utf8"));
    const ids = new Set(catalog.models.map((model) => model.id));
    for (const [scenario, template] of Object.entries(catalog.scenarioTemplates)) {
        for (const preferred of template.preferredModels) {
            assert.ok(ids.has(preferred), `${scenario} references missing model ${preferred}`);
        }
    }
});
test("model catalog parser rejects duplicate model ids", () => {
    assert.throws(() => parseModelCatalogDocument({
        version: 1,
        name: "x",
        capturedAt: "now",
        source: { command: "pi --list-models", notes: "x" },
        selectionPolicy: {
            mode: "llm-assigned",
            instruction: "x",
            mustUseAvailableModelsOnly: true,
            fallbackBehavior: "x",
        },
        scenarioTemplates: {
            docs: {
                description: "docs",
                preferredModels: ["p/m"],
                selectionHints: [],
            },
        },
        models: [
            {
                id: "p/m",
                provider: "p",
                model: "m",
                contextWindowTokens: 1,
                maxOutputTokens: 1,
                reasoning: true,
                images: false,
                relativeStrength: "x",
                costTier: "x",
                speedTier: "x",
                recommendedFor: [],
                avoidFor: [],
                notes: "x",
            },
            {
                id: "p/m",
                provider: "p",
                model: "m",
                contextWindowTokens: 1,
                maxOutputTokens: 1,
                reasoning: true,
                images: false,
                relativeStrength: "x",
                costTier: "x",
                speedTier: "x",
                recommendedFor: [],
                avoidFor: [],
                notes: "x",
            },
        ],
    }), /duplicate model id p\/m/);
});
test("model catalog parser rejects scenario templates referencing missing models", () => {
    assert.throws(() => parseModelCatalogDocument({
        version: 1,
        name: "x",
        capturedAt: "now",
        source: { command: "pi --list-models", notes: "x" },
        selectionPolicy: {
            mode: "llm-assigned",
            instruction: "x",
            mustUseAvailableModelsOnly: true,
            fallbackBehavior: "x",
        },
        scenarioTemplates: {
            docs: {
                description: "docs",
                preferredModels: ["missing/model"],
                selectionHints: [],
            },
        },
        models: [
            {
                id: "p/m",
                provider: "p",
                model: "m",
                contextWindowTokens: 1,
                maxOutputTokens: 1,
                reasoning: true,
                images: false,
                relativeStrength: "x",
                costTier: "x",
                speedTier: "x",
                recommendedFor: [],
                avoidFor: [],
                notes: "x",
            },
        ],
    }), /preferredModels references missing model missing\/model/);
});
//# sourceMappingURL=model-catalog.test.js.map