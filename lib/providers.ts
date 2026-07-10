// lib/providers.ts — provider configs, model lists, unified AI utilities

export const PROVIDER_CONFIGS = {
  groq: {
    name: "Groq",
    docsUrl: "https://console.groq.com/keys",
    keyPlaceholder: "gsk_••••••••••••••••••••••",
    keyField: "groq_api_key" as const,
    models: [
      { id: "llama-3.1-8b-instant",    name: "Llama 3.1 8B",    badge: "Fast · Free",     contextWindow: 131072 },
      { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B",   badge: "Powerful · Free", contextWindow: 131072 },
      { id: "mixtral-8x7b-32768",      name: "Mixtral 8x7B",    badge: "Free",            contextWindow: 32768 },
      { id: "gemma2-9b-it",            name: "Gemma 2 9B",      badge: "Free",            contextWindow: 8192 },
    ],
  },
  openai: {
    name: "OpenAI",
    docsUrl: "https://platform.openai.com/api-keys",
    keyPlaceholder: "sk-••••••••••••••••••••••",
    keyField: "openai_api_key" as const,
    models: [
      { id: "gpt-4o-mini",    name: "GPT-4o mini",    badge: "Fast · Cheap", contextWindow: 128000 },
      { id: "gpt-4o",         name: "GPT-4o",         badge: "Best",         contextWindow: 128000 },
      { id: "gpt-3.5-turbo",  name: "GPT-3.5 Turbo",  badge: "Legacy",       contextWindow: 16385 },
    ],
  },
  anthropic: {
    name: "Anthropic",
    docsUrl: "https://console.anthropic.com/settings/keys",
    keyPlaceholder: "sk-ant-••••••••••••••••••",
    keyField: "anthropic_api_key" as const,
    models: [
      { id: "claude-3-5-haiku-20241022",  name: "Claude Haiku 3.5",  badge: "Fast · Cheap",  contextWindow: 200000 },
      { id: "claude-3-5-sonnet-20241022", name: "Claude Sonnet 3.5", badge: "Balanced",      contextWindow: 200000 },
      { id: "claude-3-opus-20240229",     name: "Claude Opus 3",     badge: "Most capable",  contextWindow: 200000 },
    ],
  },
} as const;

export type Provider = keyof typeof PROVIDER_CONFIGS;

export const PROVIDER_ORDER: Provider[] = ["groq", "openai", "anthropic"];

export function getDefaultModel(provider: Provider): string {
  return PROVIDER_CONFIGS[provider].models[0].id;
}

export function getModelName(provider: Provider, modelId: string): string {
  const model = PROVIDER_CONFIGS[provider].models.find((m) => m.id === modelId);
  return model?.name ?? modelId;
}

const FALLBACK_CONTEXT_WINDOW = 32768; // unknown model: assume a modest window

export function getContextWindow(provider: string, modelId: string): number {
  const config = PROVIDER_CONFIGS[provider as Provider];
  const model = config?.models.find((m) => m.id === modelId);
  return model?.contextWindow ?? FALLBACK_CONTEXT_WINDOW;
}
