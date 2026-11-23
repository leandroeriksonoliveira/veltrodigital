'use client';

import Link from 'next/link';
import { AdminLoginForm } from './_components/AdminLoginForm';
import { AdminNav } from './_components/AdminNav';
import { SECTION_META } from './_components/section-meta';
import { useAdminSession } from './_components/useAdminSession';

const OPTIONS = [
  {
    href: '/admin/reports',
    title: 'Leads e conformidade',
    description:
      'Lista de leads do analisador com contato, profissão, selo e nota. Abra o detalhe de cada lead.',
    tag: 'CRM interno',
  },
  {
    href: '/admin/consultations',
    title: 'Sites consultados',
    description:
      'Últimas URLs analisadas pelos clientes. Exporte para Excel (slug, nome, site, instagram, conselho, observação, prioridade).',
    tag: 'Exportação',
  },
] as const;

export default function AdminHomePage() {
  const session = useAdminSession();
  const meta = SECTION_META.home;

  return (
    <div className="shell">
      <div className="container">
        <AdminNav active="home" authed={session.authed} onLogout={session.logout} />

        <span className="tag">{meta.tag}</span>
        <h1>{meta.title}</h1>
        <p className="lead">{meta.lead}</p>

        {!session.authed && (
          <AdminLoginForm
            password={session.password}
            onPasswordChange={session.setPassword}
            onSubmit={session.login}
            error={session.error}
          />
        )}

        <div className="admin-menu">
          {OPTIONS.map((item) => (
            <Link key={item.href} href={item.href} className="admin-menu-card">
              <span className="admin-menu-tag">{item.tag}</span>
              <h2>{item.title}</h2>
              <p>{item.description}</p>
              <span className="admin-menu-cta">
                {session.authed ? 'Abrir →' : 'Entrar para abrir →'}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}