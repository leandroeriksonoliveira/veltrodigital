'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type ListItem = {
  id: string;
  name: string;
  email: string | null;
  profession: string;
  profile_url: string | null;
  site_url?: string | null;
  created_at: string;
  score_geral?: number | null;
  selo?: string | null;
  resumo_para_time_comercial?: string | null;
};

type AuditItem = {
  id: string;
  superficie: 'rede_social' | 'site' | 'transversal';
  secao: string;
  titulo: string;
  status: 'conforme' | 'atencao' | 'nao_conforme' | 'critico' | 'na';
  evidencia: string;
  norma: string;
  acao: string;
  penalidade_possivel: string;
  risco: 'alto' | 'medio' | 'baixo' | 'na';
};

type Scoreboard = {
  total_avaliados: number;
  conformes: number;
  atencao: number;
  nao_conformes: number;
  criticos: number;
  indice: number;
  infracoes_mapeadas?: number;
  riscos_alta?: number;
  riscos_media?: number;
  riscos_reputacionais?: number;
};

type Detail = {
  lead: Record<string, unknown>;
  client_report: Record<string, unknown> | null;
  internal_report: {
    diagnostico_geral: string;
    red_flags: { trecho: string; categoria: string; norma_violada: string; explicacao: string }[];
    penalidades_estimadas: Record<string, unknown>;
    recomendacoes_correcao: string;
    resumo_para_time_comercial: string;
    raw_ai_response?: unknown;
  } | null;
};

function statusBadge(status: string) {
  if (status === 'conforme') return { label: 'CONFORME', className: 'ok' };
  if (status === 'atencao') return { label: 'ATENÇÃO', className: 'warn' };
  if (status === 'nao_conforme') return { label: 'NÃO CONFORME', className: 'danger' };
  if (status === 'critico') return { label: 'CRÍTICO', className: 'danger' };
  return { label: 'N/A', className: '' };
}

function statusIcon(status: string) {
  if (status === 'conforme') return '✅';
  if (status === 'atencao') return '⚠️';
  if (status === 'nao_conforme') return '❌';
  if (status === 'critico') return '🔴';
  return '➖';
}

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

  const pack = (detail?.internal_report?.penalidades_estimadas || {}) as Record<string, unknown>;
  const itens = (pack.itens as AuditItem[]) || [];
  const scoreboard = (pack.scoreboard as Scoreboard) || null;
  const plano = (pack.plano_acao as { dias_7?: string[]; dias_15?: string[]; dias_30?: string[] }) || {};
  const tabela =
    (pack.penalidades_tabela as { esfera: string; consequencia: string; fundamentacao: string }[]) ||
    [];
  const analiseRede = String(pack.analise_rede_social || '');
  const analiseSite = String(pack.analise_site || '');
  const veredito = String(pack.veredito || detail?.client_report?.selo || '');

  const itensRede = useMemo(
    () => itens.filter((i) => i.superficie === 'rede_social'),
    [itens]
  );
  const itensSite = useMemo(() => itens.filter((i) => i.superficie === 'site'), [itens]);
  const itensTx = useMemo(() => itens.filter((i) => i.superficie === 'transversal'), [itens]);

  function renderItems(listItems: AuditItem[]) {
    if (!listItems.length) return <p className="hint">Nenhum item nesta superfície.</p>;
    return listItems.map((item, i) => {
      const badge = statusBadge(item.status);
      return (
        <div
          key={`${item.id}-${i}`}
          style={{
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 14,
            marginBottom: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <strong>
              {statusIcon(item.status)} {item.id} — {item.titulo}
            </strong>
            <span className={`selo ${badge.className}`} style={{ fontSize: 11, padding: '4px 10px' }}>
              {badge.label}
            </span>
          </div>
          <p className="hint" style={{ margin: '6px 0' }}>
            Seção: {item.secao} · Risco: {item.risco}
          </p>
          {item.evidencia && (
            <p style={{ margin: '6px 0' }}>
              <strong>Evidência:</strong> {item.evidencia}
            </p>
          )}
          {item.norma && (
            <p style={{ margin: '6px 0', color: 'var(--muted)' }}>
              <strong>Norma:</strong> {item.norma}
            </p>
          )}
          {(item.status === 'nao_conforme' || item.status === 'critico' || item.status === 'atencao') && (
            <>
              {item.acao && (
                <p style={{ margin: '6px 0' }}>
                  <strong>Ação:</strong> {item.acao}
                </p>
              )}
              {item.penalidade_possivel && (
                <p style={{ margin: '6px 0' }}>
                  <strong>Penalidade possível:</strong> {item.penalidade_possivel}
                </p>
              )}
            </>
          )}
        </div>
      );
    });
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

        <span className="tag">Uso interno · skill site-compliance-audit</span>
        <h1>Relatórios internos de conformidade</h1>
        <p className="lead">
          Relatório detalhado com checklist, análise de rede social, site, penalidades e plano de
          ação. Nunca exibido ao cliente final.
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
              {String(detail.lead?.phone || 'sem WhatsApp')}
              <br />
              Rede: {String(detail.lead?.profile_url || '—')}
              <br />
              Site: {String(detail.lead?.site_url || '—')}
            </p>

            {detail.client_report && (
              <p>
                Nota pública: <strong>{String(detail.client_report.score_geral)}</strong> · Selo:{' '}
                <strong>{String(detail.client_report.selo)}</strong>
                {veredito ? (
                  <>
                    {' '}
                    · Veredito: <strong>{veredito}</strong>
                  </>
                ) : null}
              </p>
            )}

            {scoreboard && (
              <div className="scores" style={{ marginTop: 16 }}>
                <div className="score-box">
                  <div className="n">{scoreboard.indice}</div>
                  <div className="l">Índice %</div>
                </div>
                <div className="score-box">
                  <div className="n">{scoreboard.total_avaliados}</div>
                  <div className="l">Avaliados</div>
                </div>
                <div className="score-box">
                  <div className="n">{scoreboard.conformes}</div>
                  <div className="l">Conformes</div>
                </div>
                <div className="score-box">
                  <div className="n">{scoreboard.atencao}</div>
                  <div className="l">Atenção</div>
                </div>
                <div className="score-box">
                  <div className="n">{scoreboard.nao_conformes}</div>
                  <div className="l">Não conformes</div>
                </div>
                <div className="score-box">
                  <div className="n">{scoreboard.criticos}</div>
                  <div className="l">Críticos</div>
                </div>
              </div>
            )}

            {detail.internal_report ? (
              <>
                <h2 style={{ fontSize: '1.15rem', marginTop: 28 }}>Diagnóstico</h2>
                <p>{detail.internal_report.diagnostico_geral}</p>

                <h2 style={{ fontSize: '1.15rem', marginTop: 28 }}>📱 Análise detalhada — Rede social</h2>
                <pre
                  style={{
                    whiteSpace: 'pre-wrap',
                    background: 'rgba(0,0,0,.3)',
                    padding: 14,
                    borderRadius: 12,
                    fontSize: '0.9rem',
                  }}
                >
                  {analiseRede || 'Sem análise de rede social neste lead.'}
                </pre>
                {renderItems(itensRede)}

                <h2 style={{ fontSize: '1.15rem', marginTop: 28 }}>🌐 Análise detalhada — Site</h2>
                <pre
                  style={{
                    whiteSpace: 'pre-wrap',
                    background: 'rgba(0,0,0,.3)',
                    padding: 14,
                    borderRadius: 12,
                    fontSize: '0.9rem',
                  }}
                >
                  {analiseSite || 'N/A — site não informado.'}
                </pre>
                {renderItems(itensSite)}

                {itensTx.length > 0 && (
                  <>
                    <h2 style={{ fontSize: '1.15rem', marginTop: 28 }}>Itens transversais</h2>
                    {renderItems(itensTx)}
                  </>
                )}

                <h2 style={{ fontSize: '1.15rem', marginTop: 28 }}>Red flags (resumo)</h2>
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

                <h2 style={{ fontSize: '1.15rem', marginTop: 28 }}>Penalidades por esfera</h2>
                <ul>
                  <li>Ética: {String(pack.esfera_etica_conselho || '—')}</li>
                  <li>LGPD/ANPD: {String(pack.esfera_lgpd_anpd || '—')}</li>
                  <li>Civil/criminal: {String(pack.esfera_civil_criminal || '—')}</li>
                </ul>
                {tabela.length > 0 && (
                  <table className="table" style={{ marginTop: 12 }}>
                    <thead>
                      <tr>
                        <th>Esfera</th>
                        <th>Consequência</th>
                        <th>Fundamentação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tabela.map((row, i) => (
                        <tr key={i}>
                          <td>{row.esfera}</td>
                          <td>{row.consequencia}</td>
                          <td>{row.fundamentacao}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <h2 style={{ fontSize: '1.15rem', marginTop: 28 }}>Plano de ação</h2>
                <p>
                  <strong>🔴 7 dias</strong>
                </p>
                <ul>
                  {(plano.dias_7 || []).map((a, i) => (
                    <li key={`7-${i}`}>{a}</li>
                  ))}
                </ul>
                <p>
                  <strong>🟡 15 dias</strong>
                </p>
                <ul>
                  {(plano.dias_15 || []).map((a, i) => (
                    <li key={`15-${i}`}>{a}</li>
                  ))}
                </ul>
                <p>
                  <strong>🟢 30 dias</strong>
                </p>
                <ul>
                  {(plano.dias_30 || []).map((a, i) => (
                    <li key={`30-${i}`}>{a}</li>
                  ))}
                </ul>

                <h2 style={{ fontSize: '1.15rem', marginTop: 28 }}>Recomendações consolidadas</h2>
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

                <h2 style={{ fontSize: '1.15rem', marginTop: 28 }}>Pitch comercial</h2>
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
                          <button
                            type="button"
                            className="btn btn-outline"
                            style={{ padding: '6px 12px' }}
                            onClick={() => openDetail(row.id)}
                          >
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
