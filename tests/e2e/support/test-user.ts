import { createHash } from 'node:crypto';

export type E2ETestUser = {
  id: string;
  email: string;
  name: string;
  image: string | null;
};

export function createE2ETestUser(seed: string): E2ETestUser {
  const digest = createHash('sha256').update(seed).digest('hex');
  const id = [
    digest.slice(0, 8),
    digest.slice(8, 12),
    digest.slice(12, 16),
    digest.slice(16, 20),
    digest.slice(20, 32),
  ].join('-');

  return {
    id,
    email: `e2e+${digest.slice(0, 12)}@second-brain.local`,
    name: 'SecondBrain E2E',
    image: null,
  };
}
