'use client';

import { createContext, ReactNode, useContext } from 'react';
import { AdminLoginForm } from './AdminLoginForm';
import { AdminNav, type AdminSection } from './AdminNav';
import { SECTION_META } from './section-meta';
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

function SectionHeader({ section }: { section: AdminSection }) {
  const meta = SECTION_META[section];
  return (
    <>
      <span className="tag">{meta.tag}</span>
      <h1>{meta.title}</h1>
      <p className="lead">{meta.lead}</p>
    </>
  );
}

export function AdminPageLayout({ section, wide, children }: Props) {
  const session = useAdminSession();

  return (
    <AdminSessionContext.Provider value={session}>
      <div className="shell">
        <div className={`container${wide ? ' container-wide' : ''}`}>
          <AdminNav active={section} authed={session.authed} onLogout={session.logout} />

          <SectionHeader section={section} />

          {!session.authed ? (
            <>
              <AdminLoginForm
                password={session.password}
                onPasswordChange={session.setPassword}
                onSubmit={session.login}
                error={session.error}
              />
              {section === 'home' && (
                <p className="hint" style={{ marginTop: 16 }}>
                  Após entrar, os atalhos para os relatórios aparecem aqui.
                </p>
              )}
            </>
          ) : (
            children
          )}
        </div>
      </div>
    </AdminSessionContext.Provider>
  );
}