'use client';

import Link from 'next/link';

export type AdminSection = 'home' | 'reports' | 'consultations';

type Props = {
  active: AdminSection;
  authed: boolean;
  onLogout: () => void;
};

const LINKS: { id: AdminSection; href: string; label: string }[] = [
  { id: 'home', href: '/admin', label: 'Início' },
  { id: 'reports', href: '/admin/reports', label: 'Leads' },
  { id: 'consultations', href: '/admin/consultations', label: 'Consultas' },
];

export function AdminNav({ active, authed, onLogout }: Props) {
  return (
    <nav className="nav">
      <Link href="/admin" className="logo">
        Veltro<span>Digital</span> · Admin
      </Link>
      <div className="nav-actions">
        {LINKS.map((link) => (
          <Link
            key={link.id}
            href={link.href}
            className={`nav-link${active === link.id ? ' is-active' : ''}`}
          >
            {link.label}
          </Link>
        ))}
        {authed && (
          <button type="button" className="btn btn-outline" onClick={onLogout}>
            Sair
          </button>
        )}
      </div>
    </nav>
  );
}