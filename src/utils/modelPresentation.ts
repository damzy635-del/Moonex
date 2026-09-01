import {
  AUTO_MODEL_ID,
  DEFAULT_MOONEX_MODEL_ID,
  MOONEX_MODELS,
  isMoonexModelId,
  normalizeMoonexModelId,
} from '../../lib/moonex-models';
import { ModelInfo } from '../types';

export const AUTO_MODEL_INFO: ModelInfo = {
  id: AUTO_MODEL_ID,
  isAuto: true,
  name: 'Auto',
  tagline: 'Moonex chooses the best profile for this task.',
  description: 'Automatically routes each request to a Moonex model profile.',
  contextWindow: 'Profile dependent',
  supportsThinking: true,
  supportsSearch: true,
  supportsVision: true,
  badge: 'Recommended',
};

export const FALLBACK_MODEL_INFO: ModelInfo = {
  id: DEFAULT_MOONEX_MODEL_ID,
  name: 'Moonex Lite 1.5',
  tagline: 'Fast everyday conversations.',
  description: 'Fast everyday conversations.',
  contextWindow: 'Profile dependent',
  supportsThinking: false,
  supportsSearch: true,
  supportsVision: false,
  badge: 'Fast',
};

export const STATIC_MOONEX_MODEL_CATALOG: ModelInfo[] = [
  AUTO_MODEL_INFO,
  ...MOONEX_MODELS.map((model) => ({
    id: model.id,
    name: model.name,
    tagline: model.description,
    description: model.description,
    contextWindow: 'Profile dependent',
    supportsThinking: model.id.includes('reasoning') || model.id.includes('ultra') || model.id.includes('pro'),
    supportsSearch: true,
    supportsVision: model.id.includes('vision'),
    badge: model.id.includes('lite') || model.id.includes('fast')
      ? 'Fast'
      : model.id.includes('ultra')
        ? 'Advanced'
        : model.id.includes('pro')
          ? 'Pro'
          : undefined,
  })),
];

export function getMoonexDisplayName(modelId: unknown): string {
  const normalized = normalizeMoonexModelId(modelId);
  if (normalized === AUTO_MODEL_ID) return AUTO_MODEL_INFO.name;
  return STATIC_MOONEX_MODEL_CATALOG.find((model) => model.id === normalized)?.name || FALLBACK_MODEL_INFO.name;
}

export function getMoonexModelInfo(modelId: unknown, models: ModelInfo[] = STATIC_MOONEX_MODEL_CATALOG): ModelInfo {
  const normalized = normalizeMoonexModelId(modelId);
  if (normalized === AUTO_MODEL_ID) return AUTO_MODEL_INFO;
  return models.find((model) => model.id === normalized)
    || STATIC_MOONEX_MODEL_CATALOG.find((model) => model.id === normalized)
    || FALLBACK_MODEL_INFO;
}

/** Keep the client catalog Moonex-only while preserving live availability metadata. */
export function mergeAvailableMoonexModels(models: ModelInfo[]): ModelInfo[] {
  const liveById = new Map(
    models
      .filter((model) => isMoonexModelId(model.id))
      .map((model) => [normalizeMoonexModelId(model.id), model])
  );
  return [
    AUTO_MODEL_INFO,
    ...STATIC_MOONEX_MODEL_CATALOG
      .filter((model) => model.id !== AUTO_MODEL_ID)
      .map((model) => ({ ...model, ...(liveById.get(model.id) || {}) })),
  ];
}
