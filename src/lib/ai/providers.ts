import { env } from '@/env';

export type ProviderConfig = {
  name: string;
  apiKey: string;
  baseURL: string;
  models: readonly string[];
};

export type ProviderAttempt = {
  name: string;
  apiKey: string;
  baseURL: string;
  model: string;
};

export type ProviderHealthAttempt =
  | (ProviderAttempt & { configured: true })
  | { name: string; model: string; configured: false };

// Change models here — nowhere else. Order matters within each provider.
const PROVIDER_MODELS = {
  bai: ['glm-5.3-flash'],
  groq: ['openai/gpt-oss-120b'],
  'google-ai-studio': ['gemini-3.5-flash', 'gemini-3.5-flash-lite'],
  nvidia: ['meta/llama-3.3-70b-instruct', 'nvidia/nemotron-3-super-120b-a12b'],
  openrouter: [
    'nvidia/nemotron-3-super-120b-a12b:free',
    'openai/gpt-oss-20b:free',
    'openrouter/free',
  ],
  xai: ['grok-4.5'],
} as const;

const CHAT_PROVIDER_MODELS = {
  bai: ['glm-5.3-flash'],
  'google-ai-studio': ['gemini-3.5-flash', 'gemini-3.5-flash-lite'],
  groq: ['openai/gpt-oss-120b'],
  nvidia: ['nvidia/nemotron-3-super-120b-a12b', 'meta/llama-3.3-70b-instruct'],
  openrouter: [
    'nvidia/nemotron-3-super-120b-a12b:free',
    'openai/gpt-oss-20b:free',
    'openrouter/free',
  ],
  xai: ['grok-4.5'],
} as const;

export function buildProviders(): ProviderConfig[] {
  const providers: ProviderConfig[] = [];

  if (env.BAI_API_KEY) {
    providers.push({
      name: 'bai',
      apiKey: env.BAI_API_KEY,
      baseURL: 'https://api.b.ai/v1',
      models: PROVIDER_MODELS.bai,
    });
  }

  if (env.GROQ_API_KEY) {
    providers.push({
      name: 'groq',
      apiKey: env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
      models: PROVIDER_MODELS.groq,
    });
  }

  if (env.GOOGLE_AI_STUDIO_API_KEY) {
    providers.push({
      name: 'google-ai-studio',
      apiKey: env.GOOGLE_AI_STUDIO_API_KEY,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      models: PROVIDER_MODELS['google-ai-studio'],
    });
  }

  if (env.NVIDIA_API_KEY) {
    providers.push({
      name: 'nvidia',
      apiKey: env.NVIDIA_API_KEY,
      baseURL: 'https://integrate.api.nvidia.com/v1',
      models: PROVIDER_MODELS.nvidia,
    });
  }

  if (env.OPENROUTER_API_KEY) {
    providers.push({
      name: 'openrouter',
      apiKey: env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
      models: PROVIDER_MODELS.openrouter,
    });
  }

  if (env.XAI_API_KEY) {
    providers.push({
      name: 'xai',
      apiKey: env.XAI_API_KEY,
      baseURL: 'https://api.x.ai/v1',
      models: PROVIDER_MODELS.xai,
    });
  }

  return providers;
}

export function buildProviderAttempts(): ProviderAttempt[] {
  return buildProviders().flatMap((provider) =>
    provider.models.map((model) => ({
      name: provider.name,
      apiKey: provider.apiKey,
      baseURL: provider.baseURL,
      model,
    })),
  );
}

export function buildChatProviderAttempts(): ProviderAttempt[] {
  const providers = new Map(
    buildProviders().map((provider) => [provider.name, provider]),
  );
  return Object.entries(CHAT_PROVIDER_MODELS).flatMap(([name, models]) => {
    const provider = providers.get(name);
    return provider
      ? models.map((model) => ({
          name,
          apiKey: provider.apiKey,
          baseURL: provider.baseURL,
          model,
        }))
      : [];
  });
}

export function buildProviderHealthAttempts(): ProviderHealthAttempt[] {
  const providers = new Map(
    buildProviders().map((provider) => [provider.name, provider]),
  );
  return Object.entries(PROVIDER_MODELS).flatMap(([name, models]) => {
    const provider = providers.get(name);
    return models.map((model) =>
      provider
        ? {
            name,
            model,
            apiKey: provider.apiKey,
            baseURL: provider.baseURL,
            configured: true as const,
          }
        : { name, model, configured: false as const },
    );
  });
}
