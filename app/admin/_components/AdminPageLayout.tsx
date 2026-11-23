'use client';

import { createContext, ReactNode, useContext } from 'react';
import { AdminLoginForm } from './AdminLoginForm';
import { AdminNav, type AdminSection } from './AdminNav';
import { useAdminSession } from './useAdminSession';

type AdminSessionValue = ReturnType<typeof useAdminSession>;

const AdminSessionContext = createContext<AdminSessionValue | null>(null);

export function useAdminSessionContext(): AdminSessionValue {
  const ctx = useContext(AdminSessionContext);
  if (!ctx) {
    throw new Error('useAdminSessionContext must be used within AdminPageLayout');
  }
  return ctx;
}

type Props = {
  section: AdminSection;
  wide?: boolean;
  children: ReactNode;
};

export function AdminPageLayout({ section, wide, children }: Props) {
  const session = useAdminSession();

  return (
    <AdminSessionContext.Provider value={session}>
      <div className="shell">
        <div className={`container${wide ? ' container-wide' : ''}`}>
          <AdminNav active={section} authed={session.authed} onLogout={session.logout} />

          {session.checking ? (
            <p className="hint">Verificando sessão…</p>
          ) : !session.authed ? (
            <AdminLoginForm
              password={session.password}
              onPasswordChange={session.setPassword}
              onSubmit={session.login}
              error={session.error}
            />
          ) : (
            children
          )}
        </div>
      </div>
    </AdminSessionContext.Provider>
  );
}