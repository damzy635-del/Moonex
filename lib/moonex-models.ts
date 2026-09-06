import * as runtime from './moonex-models.js';

export type ProviderModel = {
  id: string;
  name?: string;
  description?: string;
  context_length?: number;
  max_output_tokens?: number;
  capabilities?: {
    vision?: boolean;
    reasoning?: boolean;
    search?: boolean;
    tools?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type MoonexModelProfile = {
  id: string;
  name: string;
  description: string;
  temperature: number;
  maxTokens: number;
  preferredKeywords: string[];
  fallbackIndex: number;
  requiredCapabilities?: Array<'vision' | 'reasoning' | 'search' | 'tools'>;
};

export type AutoRoutingContext = {
  messages?: Array<{ role?: string; content?: unknown; files?: Array<{ mimeType?: string; type?: string; name?: string }> }>;
  enableWebSearch?: boolean;
  thinkingLevel?: string;
  contextBudget?: {
    estimatedInputTokens: number;
    truncated: boolean;
    droppedMessages: number;
  };
};

export type MoonexRoutingDecision = {
  profile: MoonexModelProfile;
  confidence: number;
  reason: string;
  mode: 'auto';
};

export const DEFAULT_MOONEX_MODEL_ID = runtime.DEFAULT_MOONEX_MODEL_ID as string;
export const AUTO_MODEL_ID = runtime.AUTO_MODEL_ID as string;
export const MOONEX_MODELS = runtime.MOONEX_MODELS as MoonexModelProfile[];

export const isMoonexModelId = runtime.isMoonexModelId as (value: unknown) => boolean;
export const normalizeMoonexModelId = runtime.normalizeMoonexModelId as (value: unknown, fallback?: string) => string;
export const rankProviderModels = runtime.rankProviderModels as (profile: MoonexModelProfile, providers: ProviderModel[]) => ProviderModel[];
export const resolveProviderModel = runtime.resolveProviderModel as (profile: MoonexModelProfile, providers: ProviderModel[]) => ProviderModel | null;
export const findMoonexModel = runtime.findMoonexModel as (id: string) => MoonexModelProfile;
export const decideMoonexRoute = runtime.decideMoonexRoute as (context: AutoRoutingContext) => MoonexRoutingDecision;
export const classifyMoonexTask = runtime.classifyMoonexTask as (context: AutoRoutingContext) => MoonexModelProfile;
export const resolveMoonexProfile = runtime.resolveMoonexProfile as (modelId: string, context?: AutoRoutingContext) => MoonexModelProfile;
