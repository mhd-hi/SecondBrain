'use client';

import { useEffect, useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import Image from 'next/image';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
