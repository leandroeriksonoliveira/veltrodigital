'use client';

import { FormEvent } from 'react';

type Props = {
  password: string;
  onPasswordChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  error: string;
};

export function AdminLoginForm({ password, onPasswordChange, onSubmit, error }: Props) {
  return (
    <form className="card" onSubmit={onSubmit} style={{ maxWidth: 420 }}>
      {error && <div className="error">{error}</div>}
      <label htmlFor="admin-password">Senha admin</label>
      <input
        id="admin-password"
        type="password"
        value={password}
        onChange={(e) => onPasswordChange(e.target.value)}
        required
        autoComplete="current-password"
      />
      <button className="btn" type="submit">
        Entrar
      </button>
    </form>
  );
}