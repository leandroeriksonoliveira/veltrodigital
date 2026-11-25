'use client';

import { useEffect, useState } from 'react';
import { PROFESSION_LABELS, type Profession } from '@/lib/conformidade/types';
import { AdminPageLayout, useAdminSessionContext } from '../_components/AdminPageLayout';

function professionLabel(code: string): string {
  return PROFESSION_LABELS[code as Profession] || code || '—';
}

type ListItem = {
  id: string;
  name: string;
  email: string | null;
  phone?: string | null;
  profession: string;
  profile_url: string | null;
  site_url?: string | null;
  created_at: string;
  score_geral?: number | null;
  selo?: string | null;
  cta_generico?: string | null;
};

type Detail = {
  lead: Record<string, unknown>;
  client_report: {
    score_geral?: number;
    score_lgpd?: number;
    score_marco_civil?: number;
    score_etica_profissional?: number;
    selo?: string;
    cta_generico?: string;
    penalidades_resumo?: Record<string, unknown>;
  } | null;
};

function AdminReportsContent() {
  const { refreshSession } = useAdminSessionContext();
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
        await refreshSession();
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro');
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

  async function openDetail(id: string) {
    setError('');
    try {
      const res = await fetch(`/api/admin/reports?id=${id}`);
      if (res.status === 401) {
        await refreshSession();
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erro ao carregar');
        return;
      }
      setDetail(data);
    } catch {
      setError('Não foi possível carregar o detalhe.');
    }
  }

  const pr = (detail?.client_report?.penalidades_resumo || {}) as Record<string, unknown>;
  const scoreboard = (pr.scoreboard || null) as
    | {
        indice?: number;
        total_avaliados?: number;
        conformes?: number;
        atencao?: number;
        nao_conformes?: number;
        criticos?: number;
      }
    | null;

  return (
    <>
      {detail ? (
        <div className="card">
          <button type="button" className="btn btn-outline" onClick={() => setDetail(null)}>
            ← Voltar à lista
          </button>
          <h2 style={{ marginTop: 20 }}>{String(detail.lead?.name || '')}</h2>
          <p className="hint">
            {professionLabel(String(detail.lead?.profession || ''))}
            <br />
            E-mail: {String(detail.lead?.email || '—')}
            <br />
            WhatsApp: {String(detail.lead?.phone || '—')}
            <br />
            Rede: {String(detail.lead?.profile_url || '—')}
            <br />
            Site: {String(detail.lead?.site_url || '—')}
          </p>

          {detail.client_report ? (
            <>
              <p>
                Nota: <strong>{String(detail.client_report.score_geral)}</strong> · Selo:{' '}
                <strong>{String(detail.client_report.selo)}</strong>
              </p>
              {scoreboard && (
                <div className="scores" style={{ marginTop: 16 }}>
                  <div className="score-box">
                    <div className="n">{scoreboard.indice ?? '—'}</div>
                    <div className="l">Índice %</div>
                  </div>
                  <div className="score-box">
                    <div className="n">{scoreboard.conformes ?? '—'}</div>
                    <div className="l">Conformes</div>
                  </div>
                  <div className="score-box">
                    <div className="n">{scoreboard.atencao ?? '—'}</div>
                    <div className="l">Atenção</div>
                  </div>
                  <div className="score-box">
                    <div className="n">{scoreboard.nao_conformes ?? '—'}</div>
                    <div className="l">Não conformes</div>
                  </div>
                  <div className="score-box">
                    <div className="n">{scoreboard.criticos ?? '—'}</div>
                    <div className="l">Críticos</div>
                  </div>
                </div>
              )}
              <div className="scores" style={{ marginTop: 12 }}>
                <div className="score-box">
                  <div className="n">{detail.client_report.score_lgpd ?? '—'}</div>
                  <div className="l">LGPD</div>
                </div>
                <div className="score-box">
                  <div className="n">{detail.client_report.score_marco_civil ?? '—'}</div>
                  <div className="l">Marco Civil</div>
                </div>
                {pr.suspensao_conselho ? (
                  <div className="score-box">
                    <div className="n">{detail.client_report.score_etica_profissional ?? '—'}</div>
                    <div className="l">Ética</div>
                  </div>
                ) : null}
              </div>
              <p style={{ marginTop: 16 }}>{String(detail.client_report.cta_generico || '')}</p>
              {pr.veredito ? <p className="hint">Veredito: {String(pr.veredito)}</p> : null}
            </>
          ) : (
            <p>Nota numérica não encontrada.</p>
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
                  <th>Contato</th>
                  <th>Profissão</th>
                  <th>Selo</th>
                  <th>Nota</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((row) => (
                  <tr key={row.id}>
                    <td>{new Date(row.created_at).toLocaleString('pt-BR')}</td>
                    <td>{row.name}</td>
                    <td>{row.phone || row.email || '—'}</td>
                    <td>{professionLabel(row.profession)}</td>
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
                ))}
              </tbody>
            </table>
          )}
          {!loading && list.length === 0 && <p className="hint">Nenhum lead ainda.</p>}
        </div>
      )}
    </>
  );
}

export default function AdminReportsPage() {
  return (
    <AdminPageLayout section="reports">
      <AdminReportsContent />
    </AdminPageLayout>
  );
}