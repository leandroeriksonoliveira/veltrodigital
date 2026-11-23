'use client';

import Link from 'next/link';
import { AdminPageLayout } from './_components/AdminPageLayout';

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
  return (
    <AdminPageLayout section="home">
      <span className="tag">Uso interno</span>
      <h1>Painel administrativo</h1>
      <p className="lead">Escolha um relatório abaixo ou use o menu no topo.</p>

      <div className="admin-menu">
        {OPTIONS.map((item) => (
          <Link key={item.href} href={item.href} className="admin-menu-card">
            <span className="admin-menu-tag">{item.tag}</span>
            <h2>{item.title}</h2>
            <p>{item.description}</p>
            <span className="admin-menu-cta">Abrir →</span>
          </Link>
        ))}
      </div>
    </AdminPageLayout>
  );
}