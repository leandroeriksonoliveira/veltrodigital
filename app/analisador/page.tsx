'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';

type Mode = 'texto' | 'site' | 'link_referencia' | 'imagem';

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
  const [mode, setMode] = useState<Mode>('texto');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<ClientReport | null>(null);
  const [imageBase64, setImageBase64] = useState<string>('');

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
    const payload = {
      name: String(fd.get('name') || ''),
      email: String(fd.get('email') || ''),
      phone: String(fd.get('phone') || ''),
      profession: String(fd.get('profession') || ''),
      profile_url: String(fd.get('profile_url') || ''),
      site_url: String(fd.get('site_url') || ''),
      content_text: String(fd.get('content_text') || ''),
      input_type: mode,
      image_base64: imageBase64 || undefined,
      consent: true as const,
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

  function onFile(file?: File | null) {
    if (!file) {
      setImageBase64('');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      setImageBase64(result);
    };
    reader.readAsDataURL(file);
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
          Analisador de Conformidade
          <br />
          em Redes e Sites
        </h1>
        <p className="lead">
          Avalie bio, posts ou site institucional com base em LGPD, Marco Civil da Internet e normas
          do seu conselho de classe. Você recebe uma nota numérica e o panorama de penalidades
          possíveis — sem expor o diagnóstico detalhado nesta tela.
        </p>

        {!report ? (
          <form className="card" onSubmit={onSubmit}>
            {error && <div className="error">{error}</div>}

            <div className="grid-2">
              <div>
                <label htmlFor="name">Nome completo</label>
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

            <div className="grid-2">
              <div>
                <label htmlFor="email">E-mail (opcional)</label>
                <input id="email" name="email" type="email" placeholder="seu@email.com" />
              </div>
              <div>
                <label htmlFor="phone">WhatsApp (opcional)</label>
                <input id="phone" name="phone" placeholder="(11) 98644-6779" />
              </div>
            </div>

            <div className="tabs" role="tablist">
              {(
                [
                  ['texto', 'Texto / bio / post'],
                  ['site', 'Site institucional'],
                  ['link_referencia', 'Link de perfil'],
                  ['imagem', 'Print / imagem'],
                ] as [Mode, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`tab ${mode === id ? 'active' : ''}`}
                  onClick={() => setMode(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            {mode === 'site' && (
              <>
                <label htmlFor="site_url">URL do site</label>
                <input id="site_url" name="site_url" placeholder="https://seusite.com.br" required />
                <p className="hint">
                  Coletamos evidências públicas (HTML) para cruzar com a skill de conformidade de
                  sites — política, LGPD, identificação profissional etc.
                </p>
                <label htmlFor="content_text_site">Observações adicionais (opcional)</label>
                <textarea id="content_text_site" name="content_text" placeholder="Contexto extra..." />
              </>
            )}

            {mode === 'link_referencia' && (
              <>
                <label htmlFor="profile_url">Link do perfil (Instagram, LinkedIn, etc.)</label>
                <input
                  id="profile_url"
                  name="profile_url"
                  placeholder="https://instagram.com/seu.perfil"
                />
                <p className="hint">
                  Não fazemos scraping automático (viola termos das plataformas). Cole abaixo a bio
                  ou o texto do post — o link fica só como referência para nosso time comercial.
                </p>
                <label htmlFor="content_text_link">Cole a bio / texto do post</label>
                <textarea
                  id="content_text_link"
                  name="content_text"
                  required
                  placeholder="Cole aqui o texto da bio, legendas ou roteiro..."
                />
              </>
            )}

            {mode === 'texto' && (
              <>
                <label htmlFor="profile_url_opt">Link de referência (opcional)</label>
                <input id="profile_url_opt" name="profile_url" placeholder="https://..." />
                <label htmlFor="content_text">Texto da bio, post ou roteiro</label>
                <textarea
                  id="content_text"
                  name="content_text"
                  required
                  placeholder="Cole o conteúdo a analisar..."
                />
              </>
            )}

            {mode === 'imagem' && (
              <>
                <label htmlFor="image">Upload do print</label>
                <input
                  id="image"
                  type="file"
                  accept="image/*"
                  onChange={(ev) => onFile(ev.target.files?.[0])}
                />
                <p className="hint">
                  Descreva também o texto visível no print (OCR manual) para maior precisão da
                  análise.
                </p>
                <label htmlFor="content_text_img">Texto visível no print</label>
                <textarea
                  id="content_text_img"
                  name="content_text"
                  required
                  placeholder="Transcreva o texto do print..."
                />
                <input type="hidden" name="profile_url" value="" />
              </>
            )}

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
              {loading ? 'Analisando…' : 'Gerar nota de conformidade →'}
            </button>
            <p className="disclaimer">
              Relatório orientativo. Não substitui parecer jurídico individualizado nem decisão de
              conselho de classe ou ANPD.
            </p>
          </form>
        ) : (
          <div className="card">
            <span className="tag">Relatório do cliente</span>
            <h2>Sua nota de conformidade</h2>
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
                <li>{report.penalidades_resumo.sanções_eticas || (report.penalidades_resumo as { sancoes_eticas?: string }).sancoes_eticas}</li>
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
              Os detalhes técnicos da análise ficam restritos à equipe Veltro Digital. Esta tela
              exibe apenas a nota, o selo e os limites de penalidades previstos em lei.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
