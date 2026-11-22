'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';

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

function seloClass(selo: string) {
  if (selo === 'Aprovado') return 'ok';
  if (selo === 'Risco Moderado') return 'warn';
  return 'danger';
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, '');
}

export default function AnalisadorPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<ClientReport | null>(null);
  const [siteUrl, setSiteUrl] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [requestSent, setRequestSent] = useState(false);

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

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setReport(null);
    setRequestSent(false);
    setLoading(true);

    const site = siteUrl.trim();
    const wa = phone.trim();
    const mail = email.trim();

    if (!site) {
      setError('Informe o link do seu site.');
      setLoading(false);
      return;
    }
    if (!wa && !mail) {
      setError('Informe WhatsApp ou e-mail para receber o retorno.');
      setLoading(false);
      return;
    }

    const payload = {
      name: '',
      email: mail,
      phone: wa,
      profession: 'outro',
      profile_url: '',
      site_url: site,
      consent: true,
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

        <span className="tag">Conformidade Digital</span>
        <h1>
          Qual é a nota do
          <br />
          seu site?
        </h1>
        <p className="lead">
          Informe o site e um contato. Em segundos você recebe a nota inicial de conformidade e os
          riscos de multa associados.
        </p>

        {!report ? (
          <form className="card" onSubmit={onSubmit}>
            {error && <div className="error">{error}</div>}

            <label htmlFor="site_url">Site</label>
            <input
              id="site_url"
              name="site_url"
              type="url"
              required
              placeholder="https://seusite.com.br"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
            />

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

            <button className="btn" type="submit" disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Gerando sua nota…' : 'Ver minha nota →'}
            </button>
            <p className="disclaimer">
              Nota orientativa. Não substitui parecer jurídico, decisão de conselho de classe ou da
              ANPD.
            </p>
          </form>
        ) : (
          <div className="card">
            <span className="tag">Sua nota inicial</span>
            <h2 style={{ marginTop: 8 }}>Resultado</h2>
            <div className={`selo ${seloClass(report.selo)}`}>{report.selo}</div>
            <p className="hint" style={{ marginTop: 10 }}>
              Nota <strong>{report.score_geral}</strong>
              {report.veredito ? ` · ${report.veredito}` : ''}
              {siteUrl ? (
                <>
                  <br />
                  Site analisado: {siteUrl}
                </>
              ) : null}
            </p>

            <div className="scores" style={{ marginTop: 20 }}>
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
              <p className="hint" style={{ marginTop: 12 }}>
                {sb.conformes} conformes · {sb.atencao} em atenção · {sb.nao_conformes} não
                conformes · {sb.criticos} críticos
              </p>
            )}

            <div className="penalties" style={{ marginTop: 20 }}>
              <h2 style={{ fontSize: '1.15rem' }}>Riscos de multa e penalidade</h2>
              <ul>
                <li>
                  <strong>ANPD / LGPD:</strong> {report.penalidades_resumo.multa_anpd_max}
                </li>
                <li>
                  <strong>Referência PF:</strong> {report.penalidades_resumo.multa_pf_referencia}
                </li>
                <li>
                  <strong>Conselho de classe:</strong> {report.penalidades_resumo.suspensao_conselho}
                </li>
                <li>
                  <strong>Sanções éticas:</strong> {sancoes}
                </li>
                <li>
                  <strong>Imagem:</strong> {report.penalidades_resumo.riscos_imagem}
                </li>
              </ul>
            </div>

            <div
              style={{
                marginTop: 24,
                padding: '18px 18px 16px',
                borderRadius: 14,
                border: '1px solid rgba(248, 113, 113, 0.35)',
                background: 'rgba(248, 113, 113, 0.08)',
              }}
            >
              <h2 style={{ fontSize: '1.2rem', margin: 0 }}>
                Corrija já sua presença digital
              </h2>
              <p style={{ margin: '10px 0 0', color: 'var(--muted, #b8c0cc)', lineHeight: 1.55 }}>
                Uma nota baixa aumenta a exposição a multas, sanções de conselho e dano
                reputacional. Ajuste site e canais digitais agora — com prioridade clara — para
                reduzir esse risco antes de uma fiscalização ou reclamação.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 20 }}>
              <a className="btn" href={waLink} target="_blank" rel="noopener noreferrer">
                WhatsApp · (11) 98644-6779
              </a>
              <a className="btn btn-outline" href={mailLink}>
                E-mail · contato@veltrodigital.com.br
              </a>
            </div>

            <form className="card" onSubmit={onRequestHelp} style={{ marginTop: 20, background: 'rgba(255,255,255,0.03)' }}>
              <h2 style={{ fontSize: '1.1rem', marginTop: 0 }}>Solicitar agora</h2>
              <p className="hint" style={{ marginTop: 0 }}>
                Confirmamos seu contato e a equipe da Veltro retorna com o próximo passo.
              </p>
              {error && <div className="error">{error}</div>}
              <div className="grid-2">
                <div>
                  <label htmlFor="req_phone">Seu WhatsApp</label>
                  <input
                    id="req_phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(11) 98644-6779"
                  />
                </div>
                <div>
                  <label htmlFor="req_email">Seu e-mail</label>
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
                Solicitar correção agora →
              </button>
              {requestSent && (
                <p className="hint" style={{ marginTop: 10, color: '#4ade80' }}>
                  Solicitação aberta. Se o WhatsApp não abriu, use os botões acima ou ligue para
                  (11) 98644-6779
                  {digitsOnly(phone) ? ` · seu contato: ${phone}` : ''}.
                </p>
              )}
            </form>

            <button
              className="btn btn-outline"
              type="button"
              style={{ marginTop: 16 }}
              onClick={() => {
                setReport(null);
                setRequestSent(false);
              }}
            >
              Nova análise
            </button>
            <p className="disclaimer">
              Esta tela mostra apenas a nota inicial e os limites legais de risco. O detalhamento
              completo fica com a equipe Veltro Digital.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
