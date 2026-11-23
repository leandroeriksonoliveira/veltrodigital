'use client';

import { useEffect, useState } from 'react';
import { AdminPageLayout, useAdminSessionContext } from '../_components/AdminPageLayout';

type ConsultationItem = {
  id: string;
  created_at: string;
  url_consultada: string;
  site_url: string | null;
  profile_url: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  profession_label: string;
  input_type_label: string;
  score_geral: number | null;
  selo: string | null;
  veredito: string | null;
};

function AdminConsultationsContent() {
  const { refreshSession } = useAdminSessionContext();
  const [error, setError] = useState('');
  const [list, setList] = useState<ConsultationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function loadList() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/consultations?limit=200');
      if (res.status === 401) {
        await refreshSession();
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro');
      setList(data.consultations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadList();
  }, []);

  async function exportExcel() {
    setExporting(true);
    setError('');
    try {
      const res = await fetch('/api/admin/consultations?export=excel&limit=500', {
        credentials: 'include',
      });
      if (res.status === 401) {
        await refreshSession();
        throw new Error('Sessão expirada — faça login novamente.');
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || 'Falha ao exportar');
      }
      const blob = await res.blob();
      const stamp = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `consultas-sites-${stamp}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao exportar');
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <div className="card">
        <div className="toolbar">
          <p className="hint" style={{ margin: 0 }}>
            {list.length} consulta(s) listada(s)
          </p>
          <button
            type="button"
            className="btn"
            onClick={exportExcel}
            disabled={exporting || list.length === 0}
          >
            {exporting ? 'Exportando…' : 'Exportar Excel'}
          </button>
        </div>
        {error && <div className="error">{error}</div>}
        {loading ? (
          <p>Carregando…</p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Site / URL</th>
                  <th>Cliente</th>
                  <th>Profissão</th>
                  <th>Tipo</th>
                  <th>Selo</th>
                  <th>Nota</th>
                  <th>Veredito</th>
                </tr>
              </thead>
              <tbody>
                {list.map((row) => (
                  <tr key={row.id}>
                    <td>{new Date(row.created_at).toLocaleString('pt-BR')}</td>
                    <td className="cell-url">
                      {row.url_consultada ? (
                        <a href={row.url_consultada} target="_blank" rel="noreferrer">
                          {row.url_consultada.replace(/^https?:\/\//i, '').slice(0, 48)}
                          {row.url_consultada.length > 52 ? '…' : ''}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <div>{row.name}</div>
                      <div className="hint tiny">{row.phone || row.email || '—'}</div>
                    </td>
                    <td>{row.profession_label}</td>
                    <td>{row.input_type_label}</td>
                    <td>{row.selo || '—'}</td>
                    <td>{row.score_geral ?? '—'}</td>
                    <td>{row.veredito || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && list.length === 0 && <p className="hint">Nenhuma consulta registrada ainda.</p>}
      </div>
    </>
  );
}

export default function AdminConsultationsPage() {
  return (
    <AdminPageLayout section="consultations" wide>
      <AdminConsultationsContent />
    </AdminPageLayout>
  );
}