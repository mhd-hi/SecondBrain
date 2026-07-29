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

// Change models here — nowhere else. Order matters within each provider.
const PROVIDER_MODELS = {
  groq: ['llama-3.3-70b-versatile'],
  'google-ai-studio': ['gemini-2.5-flash'],
  cerebras: ['llama-3.3-70b'],
  nvidia: ['meta/llama-3.3-70b-instruct'],
  openrouter: ['meta-llama/llama-3.3-70b-instruct:free'],
  openai: ['gpt-4o-mini'],
} as const;

export function buildProviders(): ProviderConfig[] {
  const providers: ProviderConfig[] = [];

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

  if (env.CEREBRAS_API_KEY) {
    providers.push({
      name: 'cerebras',
      apiKey: env.CEREBRAS_API_KEY,
      baseURL: 'https://api.cerebras.ai/v1',
      models: PROVIDER_MODELS.cerebras,
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

  if (env.OPENAI_API_KEY) {
    providers.push({
      name: 'openai',
      apiKey: env.OPENAI_API_KEY,
      baseURL: 'https://api.openai.com/v1',
      models: PROVIDER_MODELS.openai,
    });
  }

  return providers;
}

export function buildProviderAttempts(): ProviderAttempt[] {
  return buildProviders().flatMap(provider =>
    provider.models.map(model => ({
      name: provider.name,
      apiKey: provider.apiKey,
      baseURL: provider.baseURL,
      model,
    })),
  );
}
