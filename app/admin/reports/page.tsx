'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';

type ListItem = {
  id: string;
  name: string;
  email: string | null;
  profession: string;
  profile_url: string | null;
  created_at: string;
  score_geral?: number | null;
  selo?: string | null;
  resumo_para_time_comercial?: string | null;
};

type Detail = {
  lead: Record<string, unknown>;
  client_report: Record<string, unknown> | null;
  internal_report: {
    diagnostico_geral: string;
    red_flags: { trecho: string; categoria: string; norma_violada: string; explicacao: string }[];
    penalidades_estimadas: Record<string, string>;
    recomendacoes_correcao: string;
    resumo_para_time_comercial: string;
  } | null;
};

export default function AdminReportsPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [list, setList] = useState<ListItem[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadList() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/reports');
      if (res.status === 401) {
        setAuthed(false);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro');
      setAuthed(true);
      setList(data.reports || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadList();
  }, []);

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
    await loadList();
  }

  async function openDetail(id: string) {
    const res = await fetch(`/api/admin/reports?id=${id}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Erro ao carregar');
      return;
    }
    setDetail(data);
  }

  async function logout() {
    await fetch('/api/admin/login', { method: 'DELETE' });
    setAuthed(false);
    setDetail(null);
    setList([]);
  }

  return (
    <div className="shell">
      <div className="container">
        <nav className="nav">
          <Link href="/" className="logo">
            Veltro<span>Digital</span> · Admin
          </Link>
          {authed && (
            <button type="button" className="btn btn-outline" onClick={logout}>
              Sair
            </button>
          )}
        </nav>

        <span className="tag">Uso interno</span>
        <h1>Relatórios internos de conformidade</h1>
        <p className="lead">
          Diagnóstico completo, red flags e argumentos comerciais. Nunca exibido ao cliente final.
        </p>

        {!authed ? (
          <form className="card" onSubmit={login} style={{ maxWidth: 420 }}>
            {error && <div className="error">{error}</div>}
            <label htmlFor="password">Senha admin</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button className="btn" type="submit">
              Entrar
            </button>
          </form>
        ) : detail ? (
          <div className="card">
            <button type="button" className="btn btn-outline" onClick={() => setDetail(null)}>
              ← Voltar à lista
            </button>
            <h2 style={{ marginTop: 20 }}>{String(detail.lead?.name || '')}</h2>
            <p className="hint">
              {String(detail.lead?.profession || '')} · {String(detail.lead?.email || 'sem e-mail')} ·{' '}
              {String(detail.lead?.profile_url || 'sem URL')}
            </p>

            {detail.client_report && (
              <p>
                Nota pública: <strong>{String(detail.client_report.score_geral)}</strong> · Selo:{' '}
                <strong>{String(detail.client_report.selo)}</strong>
              </p>
            )}

            {detail.internal_report ? (
              <>
                <h2 style={{ fontSize: '1.15rem', marginTop: 24 }}>Diagnóstico</h2>
                <p>{detail.internal_report.diagnostico_geral}</p>

                <h2 style={{ fontSize: '1.15rem', marginTop: 24 }}>Red flags</h2>
                {(detail.internal_report.red_flags || []).map((rf, i) => (
                  <div
                    key={i}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      padding: 14,
                      marginBottom: 10,
                    }}
                  >
                    <strong>{rf.categoria}</strong> · {rf.norma_violada}
                    <p style={{ margin: '8px 0 4px', color: 'var(--muted)' }}>
                      Trecho: “{rf.trecho}”
                    </p>
                    <p style={{ margin: 0 }}>{rf.explicacao}</p>
                  </div>
                ))}

                <h2 style={{ fontSize: '1.15rem', marginTop: 24 }}>Penalidades estimadas</h2>
                <ul>
                  <li>Ética: {detail.internal_report.penalidades_estimadas.esfera_etica_conselho}</li>
                  <li>LGPD/ANPD: {detail.internal_report.penalidades_estimadas.esfera_lgpd_anpd}</li>
                  <li>
                    Civil/criminal: {detail.internal_report.penalidades_estimadas.esfera_civil_criminal}
                  </li>
                </ul>

                <h2 style={{ fontSize: '1.15rem', marginTop: 24 }}>Recomendações</h2>
                <pre
                  style={{
                    whiteSpace: 'pre-wrap',
                    background: 'rgba(0,0,0,.3)',
                    padding: 14,
                    borderRadius: 12,
                    fontSize: '0.9rem',
                  }}
                >
                  {detail.internal_report.recomendacoes_correcao}
                </pre>

                <h2 style={{ fontSize: '1.15rem', marginTop: 24 }}>Pitch comercial</h2>
                <p>{detail.internal_report.resumo_para_time_comercial}</p>
              </>
            ) : (
              <p>Relatório interno não encontrado.</p>
            )}
          </div>
        ) : (
          <div className="card">
            {error && <div className="error">{error}</div>}
            {loading ? (
              <p>Carregando…</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Nome</th>
                    <th>Profissão</th>
                    <th>Selo</th>
                    <th>Nota</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((row) => {
                    return (
                      <tr key={row.id}>
                        <td>{new Date(row.created_at).toLocaleString('pt-BR')}</td>
                        <td>{row.name}</td>
                        <td>{row.profession}</td>
                        <td>{row.selo || '—'}</td>
                        <td>{row.score_geral ?? '—'}</td>
                        <td>
                          <button type="button" className="btn btn-outline" style={{ padding: '6px 12px' }} onClick={() => openDetail(row.id)}>
                            Abrir
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {!loading && list.length === 0 && <p className="hint">Nenhum lead ainda.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
