'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

export function useAdminSession() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const refreshSession = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/admin/session');
      const data = await res.json();
      setAuthed(Boolean(data.authenticated));
    } catch {
      setAuthed(false);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  async function login(e: FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Falha no login');
      return;
    }
    setAuthed(true);
    setPassword('');
  }

  async function logout() {
    await fetch('/api/admin/login', { method: 'DELETE' });
    setAuthed(false);
  }

  return {
    authed,
    checking,
    password,
    setPassword,
    error,
    setError,
    login,
    logout,
    refreshSession,
  };
}