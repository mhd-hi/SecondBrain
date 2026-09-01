'use client';

import { useCallback, useEffect, useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import Image from 'next/image';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type McpConnection = {
  id: string;
  clientName: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

export function McpConnectionsCard() {
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
      toast.success('Connection revoked');
      await load();
    } catch {
      toast.error('Could not revoke connection');
    } finally {
      setRevoking(null);
    }
  };

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
        {connections === null
          ? (
            <p className="text-sm text-gray-500">Loading…</p>
          )
          : connections.length === 0
            ? (
              <p className="text-sm text-gray-500">
                No AI clients connected yet.
              </p>
            )
            : (
              <ul className="flex flex-col gap-2">
                {connections.map((connection) => (
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
      </CardContent>
    </Card>
  );
}

export function ProfileTab() {
  const { data: session } = useSession();

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
      <CardContent className="flex flex-col sm:flex-row items-center gap-4 sm:justify-between">
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
      </CardContent>
    </Card>
  );
}
