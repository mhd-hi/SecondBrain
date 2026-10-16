'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type McpConnection = {
  id: string;
  clientName: string;
  scopes: string[];
  keyPrefix: string | null;
  keyLastUsedAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL
  ? new URL(process.env.NEXT_PUBLIC_APP_URL).origin
  : null;

function CopyButton({
  value,
  label = 'endpoint',
}: {
  value: string;
  label?: string;
}) {
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
  const [origin, setOrigin] = useState(configuredOrigin ?? '');

  useEffect(() => {
    if (!configuredOrigin) {
      setOrigin(window.location.origin);
    }
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
    <div className="space-y-3 rounded-md border p-4">
      <p className="text-sm font-medium">Connect a new client</p>
      <ol className="text-muted-foreground list-inside list-decimal space-y-2 text-sm">
        <li>
          <span className="text-foreground">Create an API key above.</span>{' '}
          <span className="text-foreground">
            It is shown only once — copy it immediately.
          </span>
        </li>
        <li>
          <span className="text-foreground">
            Point your MCP client at this server URL:
          </span>
          <span className="mt-1 flex items-center gap-1">
            <code className="bg-muted flex-1 truncate rounded px-2 py-1 text-xs">
              {endpoint}
            </code>
            <CopyButton value={endpoint} />
          </span>
        </li>
        <li>
          <span className="text-foreground">
            Authenticate with the API key as a bearer token, for example in a
            YAML config:
          </span>
          <span className="mt-1 flex items-start gap-1">
            <pre className="bg-muted flex-1 overflow-x-auto rounded px-2 py-1.5 text-xs leading-relaxed">
              {config}
            </pre>
            <CopyButton value={config} label="config" />
          </span>
        </li>
        <li>
          <span className="text-foreground">
            Proposed changes open in authenticated web review — nothing changes
            until you approve.
          </span>
        </li>
      </ol>
      <a
        href="https://modelcontextprotocol.io/docs/getting-started/intro"
        target="_blank"
        rel="noreferrer"
        className="text-muted-foreground inline-flex items-center gap-1 text-xs underline-offset-2 hover:underline"
      >
        MCP client documentation
        <ExternalLink className="size-3" />
      </a>
    </div>
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

  const keys =
    connections?.filter((connection) => connection.keyPrefix) ?? null;

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
      toast.error(
        error instanceof Error ? error.message : 'Could not create API key',
      );
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
          Clients connected through the Model Context Protocol (MCP) can read
          your courses and tasks and propose task changes for your approval.
          Revoking the MCP API key takes effect immediately. A read-only key can
          search and read; read + write can also propose task changes. Keys are
          shown once — store them somewhere safe.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            maxLength={40}
            placeholder="Key label, e.g. OpenCode laptop"
            className="sm:max-w-xs"
            autoComplete="off"
          />
          <label className="text-muted-foreground flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={readOnly}
              onChange={(event) => setReadOnly(event.target.checked)}
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
          <div className="space-y-2 rounded-md border border-amber-500/50 bg-amber-500/5 p-3">
            <p className="text-sm font-medium">
              Copy your key now — it will not be shown again.
            </p>
            <div className="flex items-start gap-1">
              <code className="bg-muted flex-1 rounded px-2 py-1.5 text-xs break-all">
                {newKey}
              </code>
              <CopyButton value={newKey} label="API key" />
            </div>
            <Button variant="outline" size="sm" onClick={() => setNewKey(null)}>
              Done
            </Button>
          </div>
        )}
        {keys === null ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : keys.length === 0 ? (
          <p className="text-sm text-gray-500">No API keys yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {keys.map((key) => (
              <li
                key={key.id}
                className="flex items-center justify-between gap-3 rounded-md border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    <code className="mr-2 text-xs">{key.keyPrefix}…</code>
                    {key.clientName}
                    {!key.revokedAt &&
                      !key.scopes.includes('secondbrain:write') && (
                        <span className="bg-muted text-muted-foreground ml-2 rounded px-1.5 py-0.5 text-xs">
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

export function McpTab() {
  const [connections, setConnections] = useState<McpConnection[] | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/mcp/connections', {
        cache: 'no-store',
      });
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
      <ConnectInstructions />
    </>
  );
}
