import { describe, expect, it, vi } from 'vitest';

const googleProviderMock = vi.fn((options: { clientId: string; clientSecret: string }) => ({
  id: 'google',
  options,
}));
const discordProviderMock = vi.fn((options: { clientId: string; clientSecret: string }) => ({
  id: 'discord',
  options,
}));

vi.mock('next-auth/providers/google', () => ({
  default: (options: { clientId: string; clientSecret: string }) => googleProviderMock(options),
}));
vi.mock('next-auth/providers/discord', () => ({
  default: (options: { clientId: string; clientSecret: string }) => discordProviderMock(options),
}));
vi.mock('@/env', () => ({
  env: {
    AUTH_GOOGLE_ID: 'google-client-id',
    AUTH_GOOGLE_SECRET: 'google-client-secret',
    AUTH_DISCORD_ID: 'discord-client-id',
    AUTH_DISCORD_SECRET: 'discord-client-secret',
  },
}));

const { authCallbacks, authPages, authProviders, sharedAuthConfig } = await import('@/server/auth/shared-config');

describe('shared auth config', () => {
  it('configures Google and Discord providers from env', () => {
    expect(googleProviderMock).toHaveBeenCalledOnce();
    expect(googleProviderMock).toHaveBeenCalledWith({
      clientId: 'google-client-id',
      clientSecret: 'google-client-secret',
    });
    expect(discordProviderMock).toHaveBeenCalledOnce();
    expect(discordProviderMock).toHaveBeenCalledWith({
      clientId: 'discord-client-id',
      clientSecret: 'discord-client-secret',
    });
    expect(authProviders).toEqual([
      {
        id: 'google',
        options: {
          clientId: 'google-client-id',
          clientSecret: 'google-client-secret',
        },
      },
      {
        id: 'discord',
        options: {
          clientId: '123456789012345678',
          clientSecret: 'discord-client-secret',
        },
      },
    ]);
  });

  it('exposes the custom auth pages through the shared config', () => {
    expect(authPages).toEqual({
      signIn: '/auth/signin',
      error: '/auth/error',
    });
    expect(sharedAuthConfig).toMatchObject({
      trustHost: true,
      providers: authProviders,
      callbacks: authCallbacks,
      pages: authPages,
    });
  });

  it('prefers the database user id when enriching the session', () => {
    const session = authCallbacks.session({
      session: {
        user: {
          id: 'session-user-id',
          email: 'user@example.com',
          name: 'Session User',
        },
      },
      user: { id: 'database-user-id' },
      token: { sub: 'token-user-id' },
    } as never);

    expect(session.user).toMatchObject({
      id: 'database-user-id',
      email: 'user@example.com',
      name: 'Session User',
    });
  });

  it('falls back to token.sub and then the existing session id when no database user is present', () => {
    const fromToken = authCallbacks.session({
      session: { user: { id: 'session-user-id' } },
      user: undefined,
      token: { sub: 'token-user-id' },
    } as never);
    const fromSession = authCallbacks.session({
      session: { user: { id: 'session-user-id' } },
      user: undefined,
      token: {},
    } as never);

    expect(fromToken.user.id).toBe('token-user-id');
    expect(fromSession.user.id).toBe('session-user-id');
  });

  it('copies the user id into token.sub during the jwt callback and preserves existing tokens otherwise', () => {
    const updatedToken = authCallbacks.jwt({
      token: { sub: 'old-user-id', name: 'Test User' },
      user: { id: 'new-user-id' },
    } as never);
    const existingToken = { sub: 'existing-user-id', name: 'Existing User' };

    expect(updatedToken).toEqual({
      sub: 'new-user-id',
      name: 'Test User',
    });
    expect(
      authCallbacks.jwt({
        token: existingToken,
        user: undefined,
      } as never),
    ).toBe(existingToken);
  });

  it('allows sign-in by default', async () => {
    await expect(authCallbacks.signIn()).resolves.toBe(true);
  });
});
