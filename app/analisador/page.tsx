'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';

type ClientReport = {
  score_geral: number;
  score_lgpd: number;
  score_marco_civil: number;
  score_etica_profissional: number;
  selo: 'Aprovado' | 'Risco Moderado' | 'Risco Crítico';
  cta_generico: string;
  penalidades_resumo: {
    multa_anpd_max: string;
    multa_pf_referencia: string;
    suspensao_conselho: string;
    riscos_imagem: string;
    sanções_eticas: string;
  };
};

const PROFESSIONS = [
  { value: 'medico', label: 'Médico(a)' },
  { value: 'advogado', label: 'Advogado(a)' },
  { value: 'fisioterapeuta', label: 'Fisioterapeuta' },
  { value: 'psicologo', label: 'Psicólogo(a)' },
  { value: 'dentista', label: 'Dentista' },
  { value: 'veterinario', label: 'Veterinário(a)' },
  { value: 'enfermeiro', label: 'Enfermeiro(a)' },
  { value: 'nutricionista', label: 'Nutricionista' },
  { value: 'arquiteto', label: 'Arquiteto(a) / Engenheiro(a)' },
  { value: 'outro', label: 'Outro' },
];

function seloClass(selo: string) {
  if (selo === 'Aprovado') return 'ok';
  if (selo === 'Risco Moderado') return 'warn';
  return 'danger';
}

export default function AnalisadorPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<ClientReport | null>(null);

  const waLink = useMemo(() => {
    const msg =
      'Olá! Fiz a análise de conformidade digital no site da Veltro e gostaria de falar com um especialista.';
    return `https://wa.me/5511986446779?text=${encodeURIComponent(msg)}`;
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setReport(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const profileUrl = String(fd.get('profile_url') || '').trim();
    const siteUrl = String(fd.get('site_url') || '').trim();
    const email = String(fd.get('email') || '').trim();
    const phone = String(fd.get('phone') || '').trim();

    if (!profileUrl && !siteUrl) {
      setError('Informe ao menos o link da rede social ou do site.');
      setLoading(false);
      return;
    }
    if (!email && !phone) {
      setError('Informe ao menos um contato: WhatsApp ou e-mail.');
      setLoading(false);
      return;
    }

    const payload = {
      name: String(fd.get('name') || ''),
      email,
      phone,
      profession: String(fd.get('profession') || ''),
      profile_url: profileUrl,
      site_url: siteUrl,
      consent: fd.get('consent') === 'on',
    };

    try {
      const res = await fetch('/api/analisar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha na análise');
      setReport(data.client_report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="shell">
      <div className="container">
        <nav className="nav">
          <Link href="/" className="logo">
            Veltro<span>Digital</span>
          </Link>
          <Link href="/#conformidade" className="btn btn-outline" style={{ padding: '10px 18px' }}>
            Voltar ao site
          </Link>
        </nav>

        <span className="tag">Conformidade Digital</span>
        <h1>
          Análise rápida de
          <br />
          conformidade digital
        </h1>
        <p className="lead">
          Cole o link da sua rede social e, se tiver, o do site. Em poucos minutos você recebe as
          notas — o relatório completo fica disponível para a equipe Veltro Digital.
        </p>

        {!report ? (
          <form className="card" onSubmit={onSubmit}>
            {error && <div className="error">{error}</div>}

            <div className="grid-2">
              <div>
                <label htmlFor="name">Seu nome</label>
                <input id="name" name="name" required placeholder="Dr(a). Seu nome" />
              </div>
              <div>
                <label htmlFor="profession">Profissão</label>
                <select id="profession" name="profession" required defaultValue="">
                  <option value="" disabled>
                    Selecione
                  </option>
                  {PROFESSIONS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label htmlFor="profile_url">Link da rede social</label>
            <input
              id="profile_url"
              name="profile_url"
              type="url"
              placeholder="https://www.instagram.com/seu.perfil/"
            />
            <p className="hint">Instagram, LinkedIn, Facebook ou similar.</p>

            <label htmlFor="site_url">Link do site (se tiver)</label>
            <input id="site_url" name="site_url" type="url" placeholder="https://seusite.com.br" />
            <p className="hint">Opcional. Se preencher, analisamos rede + site juntos.</p>

            <div className="grid-2">
              <div>
                <label htmlFor="phone">WhatsApp</label>
                <input id="phone" name="phone" placeholder="(11) 98644-6779" />
              </div>
              <div>
                <label htmlFor="email">E-mail</label>
                <input id="email" name="email" type="email" placeholder="seu@email.com" />
              </div>
            </div>
            <p className="hint">Informe pelo menos um contato: WhatsApp ou e-mail.</p>

            <label className="consent">
              <input type="checkbox" name="consent" required />
              <span>
                Li e concordo com a{' '}
                <a href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer">
                  Política de Privacidade
                </a>
                . Autorizo o tratamento dos dados para análise de conformidade e contato comercial
                (LGPD).
              </span>
            </label>

            <button className="btn" type="submit" disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Analisando seus links…' : 'Ver minha nota de conformidade →'}
            </button>
            <p className="disclaimer">
              Relatório orientativo. Não substitui parecer jurídico individualizado nem decisão de
              conselho de classe ou ANPD.
            </p>
          </form>
        ) : (
          <div className="card">
            <span className="tag">Sua nota</span>
            <h2>Resultado da conformidade</h2>
            <div className={`selo ${seloClass(report.selo)}`}>{report.selo}</div>

            <div className="scores">
              <div className="score-box">
                <div className="n">{report.score_geral}</div>
                <div className="l">Geral</div>
              </div>
              <div className="score-box">
                <div className="n">{report.score_lgpd}</div>
                <div className="l">LGPD</div>
              </div>
              <div className="score-box">
                <div className="n">{report.score_marco_civil}</div>
                <div className="l">Marco Civil</div>
              </div>
              <div className="score-box">
                <div className="n">{report.score_etica_profissional}</div>
                <div className="l">Ética profissional</div>
              </div>
            </div>

            <p>{report.cta_generico}</p>

            <div className="penalties">
              <h2 style={{ fontSize: '1.2rem' }}>Penalidades possíveis (limites legais)</h2>
              <ul>
                <li>{report.penalidades_resumo.multa_anpd_max}</li>
                <li>{report.penalidades_resumo.multa_pf_referencia}</li>
                <li>{report.penalidades_resumo.suspensao_conselho}</li>
                <li>
                  {report.penalidades_resumo.sanções_eticas ||
                    (report.penalidades_resumo as { sancoes_eticas?: string }).sancoes_eticas}
                </li>
                <li>{report.penalidades_resumo.riscos_imagem}</li>
              </ul>
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 24 }}>
              <a className="btn" href={waLink} target="_blank" rel="noopener noreferrer">
                Falar com especialista →
              </a>
              <button className="btn btn-outline" type="button" onClick={() => setReport(null)}>
                Nova análise
              </button>
            </div>
            <p className="disclaimer">
              O relatório completo (red flags, trechos e recomendações) fica disponível apenas para
              a equipe Veltro Digital em /admin/reports.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
