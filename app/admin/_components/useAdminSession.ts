'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

export function useAdminSession() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/session', {
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json();
      setAuthed(Boolean(data.authenticated));
    } catch {
      setAuthed(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  async function login(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error || 'Falha no login');
        return;
      }
      setAuthed(true);
      setPassword('');
      await refreshSession();
    } catch {
      setError('Não foi possível conectar. Tente novamente.');
    }
  }

  async function logout() {
    try {
      await fetch('/api/admin/login', { method: 'DELETE' });
    } finally {
      setAuthed(false);
    }
  }

  return {
    authed,
    checking: false,
    password,
    setPassword,
    error,
    setError,
    login,
    logout,
    refreshSession,
  };
}