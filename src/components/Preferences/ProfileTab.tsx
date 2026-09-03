'use client';

import { useCallback, useEffect, useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import Image from 'next/image';
import { toast } from 'sonner';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type McpConnection = {
  id: string;
  clientName: string;
  scopes: string[];
  keyPrefix: string | null;
  keyLastUsedAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

function CopyButton({ value, label = 'endpoint' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 px-2"
      onClick={() => {
        navigator.clipboard
          .writeText(value)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          })
          .catch(() => toast.error('Could not copy to clipboard'));
      }}
      aria-label={`Copy ${label}`}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </Button>
  );
}

function ConnectInstructions() {
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const endpoint = origin ? `${origin}/api/mcp` : '<app-origin>/api/mcp';
  const config = [
    'mcp_servers:',
    '  secondbrain:',
    `    url: "${endpoint}"`,
    '    headers:',
    '      Authorization: "Bearer sb_mcp_<your-api-key>"',
  ].join('\n');

  return (
    <div className="rounded-md border p-4 space-y-3">
      <p className="text-sm font-medium">Connect a new client</p>
      <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
        <li>
          <span className="text-foreground">Create an API key above.</span>
          {' '}
          <span className="text-foreground">It is shown only once — copy it immediately.</span>
        </li>
        <li>
          <span className="text-foreground">Point your MCP client at this server URL:</span>
          <span className="mt-1 flex items-center gap-1">
            <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs">{endpoint}</code>
            <CopyButton value={endpoint} />
          </span>
        </li>
        <li>
          <span className="text-foreground">Authenticate with the API key as a bearer token, for example in a YAML config:</span>
          <span className="mt-1 flex items-start gap-1">
            <pre className="flex-1 overflow-x-auto rounded bg-muted px-2 py-1.5 text-xs leading-relaxed">{config}</pre>
            <CopyButton value={config} label="config" />
          </span>
        </li>
        <li>
          <span className="text-foreground">Proposed task changes always appear as a review card or web page — nothing changes until you approve.</span>
        </li>
      </ol>
      <a
        href="https://modelcontextprotocol.io/docs/getting-started/intro"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
      >
        MCP client documentation
        <ExternalLink className="size-3" />
      </a>
    </div>
  );
}

export function McpSection() {
  const [connections, setConnections] = useState<McpConnection[] | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/mcp/connections', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('failed');
      }
      const data = (await response.json()) as { connections: McpConnection[] };
      setConnections(data.connections);
    } catch {
      setConnections([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const revoke = async (id: string) => {
    setRevoking(id);
    try {
      const response = await fetch(`/api/mcp/connections?id=${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Revoke failed');
      }
      toast.success('Revoked');
      await load();
    } catch {
      toast.error('Could not revoke');
    } finally {
      setRevoking(null);
    }
  };

  return (
    <>
      <McpApiKeysCard
        connections={connections}
        revoking={revoking}
        revoke={revoke}
        changed={load}
      />
      <McpClientsCard
        connections={connections}
        revoking={revoking}
        revoke={revoke}
      />
    </>
  );
}

function McpApiKeysCard({
  connections,
  revoking,
  revoke,
  changed,
}: {
  connections: McpConnection[] | null;
  revoking: string | null;
  revoke: (id: string) => Promise<void>;
  changed: () => Promise<void>;
}) {
  const [label, setLabel] = useState('');
  const [readOnly, setReadOnly] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  const keys = connections?.filter(connection => connection.keyPrefix) ?? null;

  const create = async () => {
    if (!label.trim()) {
      toast.error('Give the key a label first');
      return;
    }
    setCreating(true);
    try {
      const response = await fetch('/api/mcp/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label.trim(), readOnly }),
      });
      const data = (await response.json()) as { key?: string; error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'Could not create API key');
      }
      setNewKey(data.key ?? null);
      setLabel('');
      await changed();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create API key');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>MCP API keys</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-500">
          Static keys that authenticate AI clients to your MCP server. A
          read-only key can search and read; read + write can also propose
          task changes for your approval. Keys are shown once — store them
          somewhere safe.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={label}
            onChange={event => setLabel(event.target.value)}
            maxLength={40}
            placeholder="Key label, e.g. OpenCode laptop"
            className="sm:max-w-xs"
            autoComplete="off"
          />
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={readOnly}
              onChange={event => setReadOnly(event.target.checked)}
              className="size-4 accent-current"
            />
            Read-only
          </label>
          <Button
            onClick={() => void create()}
            disabled={creating}
            className="sm:ml-auto"
          >
            {creating ? 'Creating…' : 'Create key'}
          </Button>
        </div>
        {newKey && (
          <div className="rounded-md border border-amber-500/50 bg-amber-500/5 p-3 space-y-2">
            <p className="text-sm font-medium">
              Copy your key now — it will not be shown again.
            </p>
            <div className="flex items-start gap-1">
              <code className="flex-1 break-all rounded bg-muted px-2 py-1.5 text-xs">
                {newKey}
              </code>
              <CopyButton value={newKey} label="API key" />
            </div>
            <Button variant="outline" size="sm" onClick={() => setNewKey(null)}>
              Done
            </Button>
          </div>
        )}
        {keys === null
          ? (
            <p className="text-sm text-gray-500">Loading…</p>
          )
          : keys.length === 0
            ? (
              <p className="text-sm text-gray-500">No API keys yet.</p>
            )
            : (
              <ul className="flex flex-col gap-2">
                {keys.map(key => (
                  <li
                    key={key.id}
                    className="flex items-center justify-between gap-3 rounded-md border p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        <code className="mr-2 text-xs">{key.keyPrefix}…</code>
                        {key.clientName}
                        {!key.revokedAt && !key.scopes.includes('secondbrain:write') && (
                          <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                            read-only
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">
                        {key.revokedAt
                          ? 'Revoked'
                          : `Last used ${
                              key.keyLastUsedAt
                                ? new Date(key.keyLastUsedAt).toLocaleString()
                                : 'never'
                            }`}
                      </p>
                    </div>
                    {!key.revokedAt && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={revoking === key.id}
                        onClick={() => void revoke(key.id)}
                      >
                        Revoke
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
      </CardContent>
    </Card>
  );
}

function McpClientsCard({
  connections,
  revoking,
  revoke,
}: {
  connections: McpConnection[] | null;
  revoking: string | null;
  revoke: (id: string) => Promise<void>;
}) {
  const oauthConnections = connections?.filter(
    connection => !connection.keyPrefix,
  ) ?? null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Connected AI clients</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-gray-500">
          Clients connected through the Model Context Protocol can read your
          courses and tasks and propose task changes for your approval.
          Revoking takes effect immediately.
        </p>
        <ConnectInstructions />
        <div className="mt-4">
          {oauthConnections === null || oauthConnections.length === 0
            ? (
              <p className="text-sm text-gray-500">
                No AI clients connected yet.
              </p>
            )
            : (
              <ul className="flex flex-col gap-2">
                {oauthConnections.map((connection) => (
                  <li
                    key={connection.id}
                    className="flex items-center justify-between gap-3 rounded-md border p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {connection.clientName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {connection.revokedAt
                          ? 'Revoked'
                          : `Last used ${
                              connection.lastUsedAt
                                ? new Date(connection.lastUsedAt).toLocaleString()
                                : 'never'
                            }`}
                      </p>
                    </div>
                    {!connection.revokedAt && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={revoking === connection.id}
                        onClick={() => void revoke(connection.id)}
                      >
                        Revoke
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
        </div>
      </CardContent>
    </Card>
  );
}

export function ProfileTab() {
  const { data: session } = useSession();
  const [nickname, setNickname] = useState('');
  const [nicknameLoaded, setNicknameLoaded] = useState(false);
  const [savingNickname, setSavingNickname] = useState(false);

  useEffect(() => {
    void fetch('/api/profile', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Could not load nickname');
        }
        return response.json() as Promise<{ nickname: string }>;
      })
      .then(profile => setNickname(profile.nickname))
      .catch(() => toast.error('Could not load nickname'))
      .finally(() => setNicknameLoaded(true));
  }, []);

  const saveNickname = async () => {
    if (nickname && !/^[a-z\d]{1,15}$/i.test(nickname)) {
      toast.error('Nickname must contain 1-15 letters or numbers only');
      return;
    }

    setSavingNickname(true);
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname }),
      });
      if (!response.ok) {
        throw new Error('Could not save nickname');
      }
      toast.success(nickname ? 'Nickname saved' : 'Nickname removed');
    } catch {
      toast.error('Could not save nickname');
    } finally {
      setSavingNickname(false);
    }
  };

  const userName = session?.user?.name || 'User';
  const userEmail = session?.user?.email || '';
  const userImage = session?.user?.image;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          👋 Welcome back
          {' '}
          {userName}
          !
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:justify-between">
          <div className="flex items-center gap-3">
            {userImage && (
              <Image
                src={userImage}
                alt="Profile"
                width={40}
                height={40}
                className="w-10 h-10 rounded-full"
              />
            )}
            <div className="text-center sm:text-left">
              <p className="font-medium">{userName}</p>
              <p className="text-sm text-gray-500 mb-4">{userEmail}</p>
            </div>
          </div>
          <Button onClick={() => signOut()} variant="outline" className="w-full sm:w-auto">
            Sign Out
          </Button>
        </div>
        <div className="space-y-2">
          <Label htmlFor="nickname">Nickname</Label>
                    <p className="text-sm text-muted-foreground">
            Up to 15 letters or numbers.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="nickname"
              value={nickname}
              onChange={event => setNickname(event.target.value)}
              maxLength={15}
              pattern="[A-Za-z0-9]{1,15}"
              autoComplete="off"
              disabled={!nicknameLoaded || savingNickname}
              placeholder="Optional"
            />
            <Button
              onClick={() => void saveNickname()}
              disabled={!nicknameLoaded || savingNickname}
              className="sm:w-auto"
            >
              Save
            </Button>
          </div>

        </div>
      </CardContent>
    </Card>
  );
}
