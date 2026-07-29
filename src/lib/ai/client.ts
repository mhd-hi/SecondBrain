import { OpenAI } from 'openai';
import type { ProviderAttempt } from './providers';

const aiClients = new Map<string, OpenAI>();

export function getAIClient(provider: ProviderAttempt): OpenAI {
  const existingClient = aiClients.get(provider.name);
  if (existingClient) {
    return existingClient;
  }

  const client = new OpenAI({
    apiKey: provider.apiKey,
    baseURL: provider.baseURL,
    maxRetries: 0,
  });

  aiClients.set(provider.name, client);
  return client;
}
