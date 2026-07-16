/**
 * Coleta pública de perfis sociais — Instagram com API + fallback HTML mobile
 * (og:title / description costumam trazer bio quando a API retorna 401).
 */

export interface SocialEvidence {
  url: string;
  finalUrl: string;
  platform: 'instagram' | 'outro';
  username: string;
  title: string;
  description: string;
  bio: string;
  followersHint: string;
  textSample: string;
  summary: string;
  collectionNotes: string[];
  collectionQuality: 'full' | 'partial' | 'minimal';
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function metaContent(html: string, property: string): string {
  const re = new RegExp(
    `<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["'][^>]*>|<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${property}["'][^>]*>`,
    'i'
  );
  const m = html.match(re);
  return (m?.[1] || m?.[2] || '').trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
      try {
        return String.fromCodePoint(parseInt(h, 16));
      } catch {
        return '';
      }
    })
    .replace(/&#(\d+);/g, (_, d) => {
      try {
        return String.fromCodePoint(Number(d));
      } catch {
        return '';
      }
    });
}

export function isInstagramUrl(url: string): boolean {
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    return /(^|\.)instagram\.com$/i.test(u.hostname);
  } catch {
    return /instagram\.com/i.test(url);
  }
}

export function isSocialUrl(url: string): boolean {
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    const host = u.hostname.replace(/^www\./i, '').toLowerCase();
    return (
      host === 'instagram.com' ||
      host.endsWith('.instagram.com') ||
      host === 'linkedin.com' ||
      host.endsWith('.linkedin.com') ||
      host === 'facebook.com' ||
      host.endsWith('.facebook.com') ||
      host === 'fb.com' ||
      host === 'tiktok.com' ||
      host.endsWith('.tiktok.com') ||
      host === 'x.com' ||
      host === 'twitter.com' ||
      host.endsWith('.twitter.com') ||
      host === 'youtube.com' ||
      host.endsWith('.youtube.com') ||
      host === 'youtu.be'
    );
  } catch {
    return isInstagramUrl(url);
  }
}

export function extractInstagramUsername(url: string): string {
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    const parts = u.pathname.split('/').filter(Boolean);
    const reserved = new Set([
      'p',
      'reel',
      'reels',
      'stories',
      'explore',
      'accounts',
      'direct',
      'tv',
    ]);
    if (parts.length && !reserved.has(parts[0].toLowerCase())) {
      return parts[0].replace(/[^a-zA-Z0-9._]/g, '');
    }
  } catch {
    /* ignore */
  }
  return '';
}

const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

/** App-ID público do Instagram Web — usado pelo próprio site. */
const IG_WEB_APP_ID = '936619743392459';

type IgUser = {
  username?: string;
  full_name?: string;
  biography?: string;
  is_private?: boolean;
  is_verified?: boolean;
  external_url?: string | null;
  category_name?: string | null;
  business_category_name?: string | null;
  edge_followed_by?: { count?: number };
  edge_follow?: { count?: number };
  edge_owner_to_timeline_media?: {
    count?: number;
    edges?: Array<{
      node?: {
        shortcode?: string;
        accessibility_caption?: string | null;
        edge_media_to_caption?: {
          edges?: Array<{ node?: { text?: string } }>;
        };
      };
    }>;
  };
};

async function fetchInstagramProfileJson(username: string): Promise<IgUser | null> {
  const endpoints = [
    `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
    `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
  ];

  let lastErr = 'desconhecido';
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        headers: {
          'User-Agent': DESKTOP_UA,
          Accept: '*/*',
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
          'X-IG-App-ID': IG_WEB_APP_ID,
          'X-Requested-With': 'XMLHttpRequest',
          Referer: `https://www.instagram.com/${username}/`,
          Origin: 'https://www.instagram.com',
        },
        signal: AbortSignal.timeout(18000),
      });
      if (!res.ok) {
        lastErr = `HTTP ${res.status}`;
        continue;
      }
      const data = (await res.json()) as { data?: { user?: IgUser } };
      if (data?.data?.user) return data.data.user;
      lastErr = 'usuário vazio';
    } catch (err) {
      lastErr = err instanceof Error ? err.message : 'erro';
    }
  }
  throw new Error(`Instagram API indisponível (${lastErr})`);
}

function captionsFromUser(user: IgUser, limit = 8): string[] {
  const edges = user.edge_owner_to_timeline_media?.edges || [];
  const out: string[] = [];
  for (const edge of edges) {
    if (out.length >= limit) break;
    const node = edge.node;
    const caption = node?.edge_media_to_caption?.edges?.[0]?.node?.text?.trim();
    const alt = node?.accessibility_caption?.trim();
    const shortcode = node?.shortcode || '';
    const parts = [
      shortcode ? `Post https://www.instagram.com/p/${shortcode}/` : 'Post',
      caption ? `Legenda: ${caption}` : '',
      !caption && alt ? `Descrição de acessibilidade: ${alt}` : '',
    ].filter(Boolean);
    if (parts.length > 1) out.push(parts.join('\n'));
  }
  return out;
}

/** Extrai bio do meta description do Instagram: `... no Instagram: "bio"` */
function extractBioFromMetaDescription(desc: string): string {
  const decoded = decodeEntities(desc);
  const m =
    decoded.match(/no Instagram:\s*"([\s\S]+)"\s*$/i) ||
    decoded.match(/on Instagram:\s*"([\s\S]+)"\s*$/i);
  if (m?.[1]) return m[1].trim();
  // Às vezes vem sem aspas finais limpas
  const m2 = decoded.match(/no Instagram:\s*([\s\S]+)$/i);
  if (m2?.[1] && m2[1].length > 20 && !/^\d/.test(m2[1])) {
    return m2[1].replace(/^"|"$/g, '').trim();
  }
  return '';
}

function extractFollowersHint(text: string): string {
  const m =
    text.match(/([\d.,]+[KkMm]?)\s+seguidores?/i) ||
    text.match(/([\d.,]+[KkMm]?)\s+[Ff]ollowers?/i);
  return m?.[0] || '';
}

async function fetchInstagramHtmlProfile(username: string): Promise<{
  finalUrl: string;
  title: string;
  ogDescription: string;
  metaDescription: string;
  bio: string;
  htmlSample: string;
}> {
  const url = `https://www.instagram.com/${username}/`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': MOBILE_UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'Cache-Control': 'no-cache',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(20000),
  });
  const html = await res.text();
  const title = decodeEntities(
    metaContent(html, 'og:title') ||
      (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
        ? stripHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)![1])
        : '')
  );
  const ogDescription = decodeEntities(metaContent(html, 'og:description'));
  const metaDescription = decodeEntities(metaContent(html, 'description'));
  const bio =
    extractBioFromMetaDescription(metaDescription) ||
    extractBioFromMetaDescription(ogDescription);

  return {
    finalUrl: res.url || url,
    title: title.slice(0, 300),
    ogDescription,
    metaDescription,
    bio,
    htmlSample: stripHtml(html).slice(0, 2500),
  };
}

async function fetchGenericHtmlMeta(url: string): Promise<{
  finalUrl: string;
  title: string;
  description: string;
  textSample: string;
}> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': DESKTOP_UA,
      Accept: 'text/html',
      'Accept-Language': 'pt-BR,pt;q=0.9',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  });
  const html = await res.text();
  const title = decodeEntities(
    metaContent(html, 'og:title') ||
      (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
        ? stripHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)![1]).slice(0, 200)
        : '')
  );
  const description = decodeEntities(
    metaContent(html, 'og:description') ||
      metaContent(html, 'description') ||
      metaContent(html, 'twitter:description')
  );
  return {
    finalUrl: res.url || url,
    title,
    description,
    textSample: stripHtml(html).slice(0, 4000),
  };
}

function buildEvidence(params: {
  normalized: string;
  finalUrl: string;
  platform: 'instagram' | 'outro';
  username: string;
  title: string;
  description: string;
  bio: string;
  followersHint: string;
  textSample: string;
  notes: string[];
  collectionQuality: 'full' | 'partial' | 'minimal';
}): SocialEvidence {
  const evidence: SocialEvidence = {
    url: params.normalized,
    finalUrl: params.finalUrl,
    platform: params.platform,
    username: params.username,
    title: params.title,
    description: params.description,
    bio: params.bio,
    followersHint: params.followersHint,
    textSample: params.textSample.slice(0, 16000),
    summary: '',
    collectionNotes: params.notes,
    collectionQuality: params.collectionQuality,
  };

  evidence.summary = [
    `Plataforma: ${params.platform}`,
    `URL: ${params.finalUrl}`,
    `Username: ${params.username ? `@${params.username}` : 'n/d'}`,
    `Nome/título: ${params.title || 'n/d'}`,
    `Bio: ${params.bio || 'n/d'}`,
    `Descrição pública: ${params.description || 'n/d'}`,
    `Alcance: ${params.followersHint || 'n/d'}`,
    `Qualidade da coleta: ${params.collectionQuality}`,
    params.notes.length ? `Notas: ${params.notes.join(' | ')}` : '',
    'IMPORTANTE: A rede social FOI INFORMADA pelo usuário. NÃO diga que a rede não foi informada.',
  ]
    .filter(Boolean)
    .join('\n');

  return evidence;
}

export async function fetchSocialProfileEvidence(url: string): Promise<SocialEvidence> {
  let normalized = url.trim();
  if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;

  const platform = isInstagramUrl(normalized) ? 'instagram' : 'outro';
  const usernameFromUrl = platform === 'instagram' ? extractInstagramUsername(normalized) : '';
  const notes: string[] = [];

  if (platform === 'instagram' && usernameFromUrl) {
    // 1) API oficial web (quando não bloqueada)
    try {
      const user = await fetchInstagramProfileJson(usernameFromUrl);
      if (user) {
        const bio = (user.biography || '').trim();
        const fullName = (user.full_name || '').trim();
        const username = user.username || usernameFromUrl;
        const followers = user.edge_followed_by?.count;
        const following = user.edge_follow?.count;
        const postsCount = user.edge_owner_to_timeline_media?.count;
        const captions = captionsFromUser(user);
        const category = user.category_name || user.business_category_name || '';

        const textParts = [
          `Perfil Instagram INFORMADO pelo usuário: @${username}`,
          `URL: https://www.instagram.com/${username}/`,
          fullName ? `Nome público: ${fullName}` : '',
          bio ? `Bio:\n${bio}` : '',
          category ? `Categoria: ${category}` : '',
          user.external_url ? `Link externo no perfil: ${user.external_url}` : '',
          typeof followers === 'number' ? `Seguidores: ${followers}` : '',
          typeof following === 'number' ? `Seguindo: ${following}` : '',
          typeof postsCount === 'number' ? `Posts: ${postsCount}` : '',
          user.is_private ? 'Perfil privado: sim' : 'Perfil privado: não',
          user.is_verified ? 'Verificado: sim' : 'Verificado: não',
          captions.length
            ? `Legendas recentes (amostra pública):\n\n${captions.join('\n\n---\n\n')}`
            : 'Sem legendas recentes coletadas nesta rodada.',
          'Instrução ao auditor: auditar TODOS os itens RS-* da rede social com base neste material. NÃO marcar rede como não informada.',
        ].filter(Boolean);

        return buildEvidence({
          normalized,
          finalUrl: `https://www.instagram.com/${username}/`,
          platform: 'instagram',
          username,
          title: fullName || `@${username}`,
          description: bio,
          bio,
          followersHint: typeof followers === 'number' ? `${followers} seguidores` : '',
          textSample: textParts.join('\n\n'),
          notes: ['Coleta completa via web_profile_info.', ...notes],
          collectionQuality: captions.length || bio ? 'full' : 'partial',
        });
      }
    } catch (err) {
      notes.push(
        `API Instagram indisponível (${err instanceof Error ? err.message : 'erro'}); usando HTML público.`
      );
    }

    // 2) Fallback HTML mobile (og + meta description com bio)
    try {
      const html = await fetchInstagramHtmlProfile(usernameFromUrl);
      const bio = html.bio;
      const followersHint =
        extractFollowersHint(html.ogDescription) || extractFollowersHint(html.metaDescription);
      const textParts = [
        `Perfil Instagram INFORMADO pelo usuário: @${usernameFromUrl}`,
        `URL: https://www.instagram.com/${usernameFromUrl}/`,
        html.title ? `Nome/título público: ${html.title}` : '',
        bio ? `Bio pública coletada:\n${bio}` : '',
        html.ogDescription ? `Resumo público (og:description): ${html.ogDescription}` : '',
        html.metaDescription && html.metaDescription !== html.ogDescription
          ? `Meta description: ${html.metaDescription}`
          : '',
        followersHint ? `Indicador de alcance: ${followersHint}` : '',
        'Fonte: página pública do Instagram (metadados). Legendas de posts podem estar limitadas nesta coleta.',
        'Instrução ao auditor: a rede social FOI informada. Avaliar itens RS-* (identificação, bio, proibições éticas, LGPD) com o material acima. NÃO escrever "rede social não informada".',
      ].filter(Boolean);

      const quality: 'full' | 'partial' | 'minimal' = bio
        ? 'partial'
        : html.ogDescription || html.title
          ? 'partial'
          : 'minimal';

      if (!bio) notes.push('Bio completa não veio na API; usamos metadados públicos da página.');

      return buildEvidence({
        normalized,
        finalUrl: `https://www.instagram.com/${usernameFromUrl}/`,
        platform: 'instagram',
        username: usernameFromUrl,
        title: html.title || `@${usernameFromUrl}`,
        description: html.metaDescription || html.ogDescription,
        bio: bio || html.metaDescription || html.ogDescription,
        followersHint,
        textSample: textParts.join('\n\n'),
        notes,
        collectionQuality: quality,
      });
    } catch (err) {
      notes.push(`HTML Instagram falhou: ${err instanceof Error ? err.message : 'erro'}`);
    }

    // 3) Mínimo garantido — ainda assim força análise da rede
    return buildEvidence({
      normalized,
      finalUrl: `https://www.instagram.com/${usernameFromUrl}/`,
      platform: 'instagram',
      username: usernameFromUrl,
      title: `@${usernameFromUrl}`,
      description: '',
      bio: '',
      followersHint: '',
      textSample: [
        `Perfil Instagram INFORMADO pelo usuário: @${usernameFromUrl}`,
        `URL: https://www.instagram.com/${usernameFromUrl}/`,
        'A coleta automática de bio/posts falhou (bloqueio da plataforma).',
        'Ainda assim, a rede social FOI informada. Auditar itens RS-* com base no username/contexto profissional e marcar limitações de evidência nos itens sem material textual.',
        'NÃO escrever "rede social não informada" nem score_rede_social=0 por ausência de coleta.',
      ].join('\n'),
      notes,
      collectionQuality: 'minimal',
    });
  }

  // Outras redes: meta HTML
  try {
    const meta = await fetchGenericHtmlMeta(normalized);
    return buildEvidence({
      normalized,
      finalUrl: meta.finalUrl,
      platform: 'outro',
      username: '',
      title: meta.title,
      description: meta.description,
      bio: meta.description,
      followersHint: '',
      textSample: [
        `Perfil social INFORMADO pelo usuário`,
        `URL: ${meta.finalUrl}`,
        meta.title ? `Título: ${meta.title}` : '',
        meta.description ? `Descrição: ${meta.description}` : '',
        meta.textSample ? `Amostra: ${meta.textSample}` : '',
        'Instrução: auditar como rede social. NÃO marcar como não informada.',
      ]
        .filter(Boolean)
        .join('\n\n'),
      notes,
      collectionQuality: meta.description ? 'partial' : 'minimal',
    });
  } catch (err) {
    notes.push(`Coleta HTML falhou: ${err instanceof Error ? err.message : 'erro'}`);
    return buildEvidence({
      normalized,
      finalUrl: normalized,
      platform: 'outro',
      username: '',
      title: '',
      description: '',
      bio: '',
      followersHint: '',
      textSample: [
        `Perfil social INFORMADO: ${normalized}`,
        'Coleta automática falhou. Auditar riscos típicos e registrar limitação de evidência.',
      ].join('\n'),
      notes,
      collectionQuality: 'minimal',
    });
  }
}
