'use client';

import { useEffect, useMemo, useState } from 'react';
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
  const [notice, setNotice] = useState('');
  const [list, setList] = useState<ConsultationItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const selectedCount = selected.size;
  const allSelected = list.length > 0 && selectedCount === list.length;

  const selectedIds = useMemo(() => Array.from(selected), [selected]);

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
      const rows: ConsultationItem[] = data.consultations || [];
      setList(rows);
      setSelected((prev) => {
        const next = new Set<string>();
        for (const id of prev) {
          if (rows.some((r) => r.id === id)) next.add(id);
        }
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadList();
  }, []);

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(list.map((row) => row.id)));
  }

  async function exportExcel() {
    if (!selectedCount) {
      setError('Selecione ao menos um registro para exportar.');
      return;
    }
    setExporting(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/admin/consultations', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'export', ids: selectedIds }),
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
      setNotice(`${selectedCount} registro(s) exportado(s).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao exportar');
    } finally {
      setExporting(false);
    }
  }

  async function deleteSelected() {
    if (!selectedCount) {
      setError('Selecione ao menos um registro para excluir.');
      return;
    }
    const ok = window.confirm(
      `Excluir ${selectedCount} registro(s) da base?\n\nIsso remove o lead e os relatórios vinculados. Não dá para desfazer.`
    );
    if (!ok) return;

    setDeleting(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/admin/consultations', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      });
      if (res.status === 401) {
        await refreshSession();
        throw new Error('Sessão expirada — faça login novamente.');
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || 'Falha ao excluir');
      }
      const deleted = Number((data as { deleted?: number }).deleted || 0);
      setSelected(new Set());
      setNotice(`${deleted} registro(s) excluído(s) da base.`);
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="card">
        <div className="toolbar">
          <p className="hint" style={{ margin: 0 }}>
            {list.length} consulta(s) · {selectedCount} selecionada(s)
          </p>
          <div className="toolbar-actions">
            <button
              type="button"
              className="btn btn-outline"
              onClick={toggleAll}
              disabled={loading || list.length === 0}
            >
              {allSelected ? 'Limpar seleção' : 'Selecionar todos'}
            </button>
            <button
              type="button"
              className="btn"
              onClick={exportExcel}
              disabled={exporting || deleting || selectedCount === 0}
            >
              {exporting ? 'Exportando…' : `Exportar selecionados (${selectedCount})`}
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={deleteSelected}
              disabled={deleting || exporting || selectedCount === 0}
            >
              {deleting ? 'Excluindo…' : `Excluir selecionados (${selectedCount})`}
            </button>
          </div>
        </div>
        {error && <div className="error">{error}</div>}
        {notice && !error && <div className="notice">{notice}</div>}
        {loading ? (
          <p>Carregando…</p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th className="col-check">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="Selecionar todos"
                      disabled={list.length === 0}
                    />
                  </th>
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
                {list.map((row) => {
                  const isChecked = selected.has(row.id);
                  return (
                    <tr key={row.id} className={isChecked ? 'row-selected' : undefined}>
                      <td className="col-check">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleOne(row.id)}
                          aria-label={`Selecionar ${row.name}`}
                        />
                      </td>
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
                  );
                })}
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