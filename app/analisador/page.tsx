'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { pickPublicCase } from '@/lib/conformidade/public-cases';

/** Tempo mínimo de “Analisando” antes de revelar a nota (evita parecer aleatório). */
const MIN_ANALYSIS_MS = 20_000;

const ANALYSIS_STEPS = [
  'Lendo o site e páginas legais…',
  'Buscando Instagram e redes no HTML…',
  'Aplicando checklist LGPD e Marco Civil…',
  'Avaliando ética profissional e riscos…',
  'Consolidando a nota de conformidade…',
];

type Scoreboard = {
  total_avaliados: number;
  conformes: number;
  atencao: number;
  nao_conformes: number;
  criticos: number;
  indice: number;
  infracoes_mapeadas: number;
  riscos_alta: number;
  riscos_media: number;
  riscos_reputacionais: number;
};

type ClientReport = {
  score_geral: number;
  score_lgpd: number;
  score_marco_civil: number;
  score_etica_profissional: number;
  score_rede_social?: number | null;
  score_site?: number | null;
  selo: 'Aprovado' | 'Risco Moderado' | 'Risco Crítico';
  veredito?: string;
  cta_generico: string;
  scoreboard?: Scoreboard;
  penalidades_resumo: {
    multa_anpd_max: string;
    multa_pf_referencia: string;
    suspensao_conselho: string;
    riscos_imagem: string;
    sanções_eticas: string;
  };
};

function PublicCaseCard({ report }: { report: ClientReport }) {
  const item = pickPublicCase(report);
  return (
    <section className="exposure-panel exposure-case" aria-label="Caso público semelhante">
      <h2>Caso público</h2>
      <p className="case-kicker">
        {item.organ} · {item.year} · {item.who}
      </p>
      <p className={item.amount ? 'case-amount' : 'case-status'}>
        {item.amount ?? 'Processo aberto'}
      </p>
      <p className="case-fact">{item.fact}</p>
      <a className="case-source" href={item.sourceUrl} target="_blank" rel="noopener noreferrer">
        {item.sourceLabel}
      </a>
      <p className="case-note">Caso real e público. Não é o valor da sua nota.</p>
    </section>
  );
}

function seloClass(selo: string) {
  if (selo === 'Aprovado') return 'ok';
  if (selo === 'Risco Moderado') return 'warn';
  return 'danger';
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, '');
}

/** Aceita www.site.com.br sem https:// (o input type=url do browser rejeita). */
function normalizeSiteUrl(raw: string) {
  const t = raw.trim();
  if (!t) return '';
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

function waitMs(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/** Domínio curto para exibir no resultado. */
function displayHost(raw: string) {
  try {
    const u = new URL(normalizeSiteUrl(raw));
    return u.hostname.replace(/^www\./i, '');
  } catch {
    return raw.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0] || raw;
  }
}

export default function AnalisadorPage() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState('');
  const [report, setReport] = useState<ClientReport | null>(null);
  const [siteUrl, setSiteUrl] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [requestSent, setRequestSent] = useState(false);
  const progressTimer = useRef<number | null>(null);

  const waLink = useMemo(() => {
    const msg =
      'Olá! Vi minha nota de conformidade no analisador da Veltro e quero corrigir minha presença digital.';
    return `https://wa.me/5511986446779?text=${encodeURIComponent(msg)}`;
  }, []);

  const mailLink = useMemo(() => {
    const subject = encodeURIComponent('Quero corrigir minha presença digital');
    const body = encodeURIComponent(
      `Olá, Veltro Digital.\n\nGerei a nota de conformidade do meu site e quero falar sobre correção.\nSite: ${siteUrl || '—'}\nWhatsApp: ${phone || '—'}\nE-mail: ${email || '—'}\n`
    );
    return `mailto:contato@veltrodigital.com.br?subject=${subject}&body=${body}`;
  }, [siteUrl, phone, email]);

  useEffect(() => {
    return () => {
      if (progressTimer.current) window.clearInterval(progressTimer.current);
    };
  }, []);

  function startProgressAnimation() {
    setProgress(0);
    setStepIndex(0);
    if (progressTimer.current) window.clearInterval(progressTimer.current);
    const started = Date.now();
    progressTimer.current = window.setInterval(() => {
      const elapsed = Date.now() - started;
      // Sobe até ~92% no mínimo de 20s; o restante fecha ao revelar o resultado
      const pct = Math.min(92, Math.round((elapsed / MIN_ANALYSIS_MS) * 92));
      setProgress(pct);
      setStepIndex(Math.min(ANALYSIS_STEPS.length - 1, Math.floor((elapsed / MIN_ANALYSIS_MS) * ANALYSIS_STEPS.length)));
    }, 200);
  }

  function stopProgressAnimation(finalPct = 100) {
    if (progressTimer.current) {
      window.clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
    setProgress(finalPct);
    setStepIndex(ANALYSIS_STEPS.length - 1);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setReport(null);
    setRequestSent(false);

    const site = normalizeSiteUrl(siteUrl);
    const wa = phone.trim();
    const mail = email.trim();

    if (!site) {
      setError('Informe o link do seu site.');
      return;
    }
    if (!wa && !mail) {
      setError('Informe WhatsApp ou e-mail para receber o retorno.');
      return;
    }

    setSiteUrl(site);
    setLoading(true);
    startProgressAnimation();

    const payload = {
      name: '',
      email: mail,
      phone: wa,
      profession: 'outro',
      profile_url: '',
      site_url: site,
      consent: true,
    };

    const startedAt = Date.now();

    try {
      const [apiResult] = await Promise.all([
        (async () => {
          const res = await fetch('/api/analisar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Falha na análise');
          return data.client_report as ClientReport;
        })(),
        waitMs(MIN_ANALYSIS_MS),
      ]);

      // Garante pelo menos 20s mesmo se a API + waitMs correrem em paralelo com drift
      const remaining = MIN_ANALYSIS_MS - (Date.now() - startedAt);
      if (remaining > 0) await waitMs(remaining);

      stopProgressAnimation(100);
      await waitMs(280);
      setReport(apiResult);
    } catch (err) {
      stopProgressAnimation(0);
      setError(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setLoading(false);
    }
  }

  function onRequestHelp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const wa = phone.trim();
    const mail = email.trim();
    if (!wa && !mail) {
      setError('Informe WhatsApp ou e-mail para solicitarmos o contato.');
      return;
    }
    setError('');
    setRequestSent(true);

    const msg = [
      'Olá! Solicitei agora a correção da minha presença digital.',
      `Site: ${siteUrl || '—'}`,
      `Nota: ${report?.score_geral ?? '—'} · ${report?.selo ?? ''}`,
      wa ? `Meu WhatsApp: ${wa}` : '',
      mail ? `Meu e-mail: ${mail}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    if (wa) {
      window.open(`https://wa.me/5511986446779?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
    } else if (mail) {
      window.location.href = `mailto:contato@veltrodigital.com.br?subject=${encodeURIComponent(
        'Solicitar correção de presença digital'
      )}&body=${encodeURIComponent(msg)}`;
    }
  }

  const sb = report?.scoreboard;
  const sancoes =
    report?.penalidades_resumo.sanções_eticas ||
    (report?.penalidades_resumo as { sancoes_eticas?: string } | undefined)?.sancoes_eticas;

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

        <div className="score-head">
          <div>
            <span className="tag">Conformidade Digital</span>
            <h1>
              Seu site está em conformidade?
              <br />
              Descubra grátis em poucos minutos.
            </h1>
            <p className="lead law-hook">
              Faça uma análise inicial da sua presença digital, no site e nas redes, e veja sua nota, os principais pontos de atenção, o que pode precisar de ajuste e como evitar penalidades.
            </p>
          </div>
          <div className="law-seals" aria-label="Normas que podem gerar penalidade">
            <div className="law-seal lgpd"><span className="law-ico" aria-hidden="true">🛡️</span><strong>LGPD</strong><span>Dados</span></div>
            <div className="law-seal anpd"><span className="law-ico" aria-hidden="true">⚠️</span><strong>ANPD</strong><span>Multa</span></div>
            <div className="law-seal procon"><span className="law-ico" aria-hidden="true">🛒</span><strong>PROCON</strong><span>Consumidor</span></div>
            <div className="law-seal civil"><span className="law-ico" aria-hidden="true">📜</span><strong>Marco</strong><span>Civil</span></div>
            <div className="law-seal oab"><span className="law-ico" aria-hidden="true">⚖️</span><strong>OAB</strong><span>Advocacia</span></div>
            <div className="law-seal cfm"><span className="law-ico" aria-hidden="true">🩺</span><strong>CFM</strong><span>Saúde</span></div>
            <div className="law-seal crea"><span className="law-ico" aria-hidden="true">📐</span><strong>CREA</strong><span>Engenharia</span></div>
            <div className="law-seal cau"><span className="law-ico" aria-hidden="true">🏛️</span><strong>CAU</strong><span>Arquitetura</span></div>
          </div>
        </div>

        {loading ? (
          <div className="card analysis-loading" role="status" aria-live="polite" aria-busy="true">
            <div className="analysis-lupa" aria-hidden="true">
              <svg viewBox="0 0 64 64" width="72" height="72">
                <circle className="lupa-ring" cx="28" cy="28" r="16" fill="none" strokeWidth="3.5" />
                <line className="lupa-handle" x1="40" y1="40" x2="56" y2="56" strokeWidth="4" strokeLinecap="round" />
                <circle className="lupa-pulse" cx="28" cy="28" r="8" />
              </svg>
            </div>
            <h2 className="analysis-title">Analisando Conformidade</h2>
            <p className="analysis-sub">
              Estamos lendo o site, páginas legais e redes públicas — a nota só aparece após a
              análise completa.
            </p>
            <div className="analysis-bar" aria-hidden="true">
              <div className="analysis-bar-fill" style={{ width: `${progress}%` }} />
            </div>
            <p className="analysis-pct">{progress}%</p>
            <p className="analysis-step">{ANALYSIS_STEPS[stepIndex]}</p>
            {siteUrl ? <p className="hint">Site: {siteUrl}</p> : null}
          </div>
        ) : !report ? (
          <form className="card" onSubmit={onSubmit}>
            {error && <div className="error">{error}</div>}

            <label htmlFor="site_url">Site</label>
            <input
              id="site_url"
              name="site_url"
              type="text"
              inputMode="url"
              autoComplete="url"
              required
              placeholder="www.seusite.com.br ou https://seusite.com.br"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              onBlur={() => setSiteUrl((v) => (v.trim() ? normalizeSiteUrl(v) : v))}
            />
            <p className="hint">Pode colar com ou sem https:// — ex.: www.veltrodigital.com.br</p>

            <div className="grid-2" style={{ marginTop: 16 }}>
              <div>
                <label htmlFor="phone">WhatsApp</label>
                <input
                  id="phone"
                  name="phone"
                  placeholder="(11) 98644-6779"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="email">E-mail</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <p className="hint">Informe WhatsApp ou e-mail — usamos para devolver a nota e o próximo passo.</p>

            <label className="consent">
              <input type="checkbox" name="consent" required />
              <span>
                Concordo com a{' '}
                <a href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer">
                  Política de Privacidade
                </a>{' '}
                e autorizo o contato comercial sobre conformidade digital (LGPD).
              </span>
            </label>

            <button className="btn" type="submit" style={{ width: '100%' }}>
              Analisar meu site grátis
            </button>
            <p className="offer-note">A primeira análise é gratuita.</p>
            <p className="disclaimer">
              Nota orientativa. Não substitui parecer jurídico, decisão de conselho de classe ou da
              ANPD.
            </p>
          </form>
        ) : (
          <div className="card">
            <div className="result-head">
              <div className="result-head-main">
                <div className={`selo ${seloClass(report.selo)}`}>{report.selo}</div>
                <div className="result-score-line">
                  {report.score_geral}
                  {report.veredito ? <span> · {report.veredito}</span> : null}
                </div>
                {siteUrl ? <p className="result-url">{displayHost(siteUrl)}</p> : null}
              </div>
              <button
                className="btn btn-outline result-new"
                type="button"
                onClick={() => {
                  setReport(null);
                  setRequestSent(false);
                  setError('');
                }}
              >
                Nova consulta
              </button>
            </div>

            <div className="scores" style={{ marginTop: 0 }}>
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
                <div className="l">Ética</div>
              </div>
            </div>

            {sb && (
              <p className="result-counts">
                {sb.conformes} ok · {sb.atencao} atenção · {sb.nao_conformes} fora · {sb.criticos}{' '}
                críticos
              </p>
            )}

            <div className="exposure-grid">
              <section className="exposure-panel">
                <h2>Exposição possível</h2>
                <ul>
                  <li>
                    <strong>ANPD / LGPD:</strong> {report.penalidades_resumo.multa_anpd_max}
                  </li>
                  <li>
                    <strong>Pessoa física:</strong> {report.penalidades_resumo.multa_pf_referencia}
                  </li>
                  <li>
                    <strong>Conselho:</strong> {report.penalidades_resumo.suspensao_conselho}
                  </li>
                  {sancoes ? (
                    <li>
                      <strong>Ética:</strong> {sancoes}
                    </li>
                  ) : null}
                  <li>
                    <strong>Imagem:</strong> {report.penalidades_resumo.riscos_imagem}
                  </li>
                </ul>
              </section>
              <PublicCaseCard report={report} />
            </div>

            <div className="result-cta">
              <h2>Quer o relatório completo?</h2>
              <p>
                O detalhe do que ajustar fica no relatório. A Veltro também pode ajudar na correção.
              </p>
            </div>

            <div className="result-actions">
              <a className="btn" href={waLink} target="_blank" rel="noopener noreferrer">
                WhatsApp
              </a>
              <a className="btn btn-outline" href={mailLink}>
                E-mail
              </a>
            </div>

            <form
              className="card"
              onSubmit={onRequestHelp}
              style={{ marginTop: 20, background: 'rgba(255,255,255,0.03)' }}
            >
              <h2 style={{ fontSize: '1.05rem', marginTop: 0 }}>Falar com a Veltro</h2>
              <p className="hint" style={{ marginTop: 0 }}>
                Deixe seu contato. Retornamos com o próximo passo.
              </p>
              {error && <div className="error">{error}</div>}
              <div className="grid-2">
                <div>
                  <label htmlFor="req_phone">WhatsApp</label>
                  <input
                    id="req_phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(11) 98644-6779"
                  />
                </div>
                <div>
                  <label htmlFor="req_email">E-mail</label>
                  <input
                    id="req_email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                  />
                </div>
              </div>
              <button className="btn" type="submit" style={{ width: '100%', marginTop: 8 }}>
                Solicitar agora →
              </button>
              {requestSent && (
                <p className="hint" style={{ marginTop: 10, color: '#4ade80' }}>
                  Solicitação enviada.
                  {digitsOnly(phone) ? ` Contato: ${phone}.` : ''}
                </p>
              )}
            </form>

            <p className="disclaimer">
              Nota orientativa. O detalhamento completo fica com a equipe Veltro.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
