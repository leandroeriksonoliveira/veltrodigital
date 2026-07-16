/**
 * Coleta pública de perfis sociais — Instagram via endpoint web público
 * (mesmo usado pelo site do Instagram) + fallback HTML/meta.
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
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
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

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

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
  const res = await fetch(
    `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
    {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: '*/*',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        'X-IG-App-ID': IG_WEB_APP_ID,
        Referer: 'https://www.instagram.com/',
        Origin: 'https://www.instagram.com',
      },
      signal: AbortSignal.timeout(20000),
    }
  );

  if (!res.ok) {
    throw new Error(`Instagram API HTTP ${res.status}`);
  }

  const data = (await res.json()) as { data?: { user?: IgUser } };
  return data?.data?.user || null;
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

async function fetchHtmlMetaFallback(url: string): Promise<{
  finalUrl: string;
  title: string;
  description: string;
  textSample: string;
}> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': BROWSER_UA,
      Accept: 'text/html',
      'Accept-Language': 'pt-BR,pt;q=0.9',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  });
  const html = await res.text();
  const title =
    decodeEntities(metaContent(html, 'og:title')) ||
    (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
      ? stripHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)![1]).slice(0, 200)
      : '');
  const description = decodeEntities(
    metaContent(html, 'og:description') || metaContent(html, 'twitter:description')
  );
  return {
    finalUrl: res.url || url,
    title,
    description,
    textSample: stripHtml(html).slice(0, 4000),
  };
}

export async function fetchSocialProfileEvidence(url: string): Promise<SocialEvidence> {
  let normalized = url.trim();
  if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;

  const platform = isInstagramUrl(normalized) ? 'instagram' : 'outro';
  const usernameFromUrl = platform === 'instagram' ? extractInstagramUsername(normalized) : '';
  const notes: string[] = [];

  if (platform === 'instagram' && usernameFromUrl) {
    try {
      const user = await fetchInstagramProfileJson(usernameFromUrl);
      if (!user) {
        notes.push('Endpoint Instagram retornou usuário vazio.');
      } else {
        const bio = (user.biography || '').trim();
        const fullName = (user.full_name || '').trim();
        const username = user.username || usernameFromUrl;
        const followers = user.edge_followed_by?.count;
        const following = user.edge_follow?.count;
        const postsCount = user.edge_owner_to_timeline_media?.count;
        const captions = captionsFromUser(user);
        const category = user.category_name || user.business_category_name || '';

        const textParts = [
          `Perfil Instagram: @${username}`,
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
            : 'Sem legendas recentes coletadas.',
        ].filter(Boolean);

        const textSample = textParts.join('\n\n').slice(0, 16000);
        const evidence: SocialEvidence = {
          url: normalized,
          finalUrl: `https://www.instagram.com/${username}/`,
          platform: 'instagram',
          username,
          title: fullName || `@${username}`,
          description: bio,
          bio,
          followersHint: typeof followers === 'number' ? `${followers} seguidores` : '',
          textSample,
          summary: '',
          collectionNotes: [
            'Coleta via endpoint público web_profile_info do Instagram.',
            ...notes,
          ],
        };

        evidence.summary = [
          `Plataforma: instagram`,
          `URL: ${evidence.finalUrl}`,
          `Username: @${username}`,
          `Nome: ${fullName || 'n/d'}`,
          `Bio: ${bio || 'n/d'}`,
          `Seguidores: ${followers ?? 'n/d'}`,
          `Posts amostrados: ${captions.length}`,
          user.is_private ? 'ATENÇÃO: perfil privado — conteúdo limitado.' : '',
        ]
          .filter(Boolean)
          .join('\n');

        return evidence;
      }
    } catch (err) {
      notes.push(
        `Falha na API Instagram (${err instanceof Error ? err.message : 'erro'}); tentando fallback HTML.`
      );
    }
  }

  // Fallback: meta HTML (ou redes não-Instagram)
  try {
    const meta = await fetchHtmlMetaFallback(normalized);
    const username = usernameFromUrl;
    const textSample = [
      username ? `Username: @${username}` : '',
      meta.title ? `Título: ${meta.title}` : '',
      meta.description ? `Descrição pública: ${meta.description}` : '',
      `URL: ${meta.finalUrl}`,
      meta.textSample ? `Amostra HTML: ${meta.textSample}` : '',
      platform === 'instagram'
        ? 'Observação: coleta completa indisponível; analisar com base nos metadados e riscos típicos de perfis profissionais.'
        : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    if (!meta.description && platform === 'instagram') {
      notes.push('Metadados limitados — Instagram pode exigir revisão humana complementar.');
    }

    const evidence: SocialEvidence = {
      url: normalized,
      finalUrl: meta.finalUrl,
      platform,
      username,
      title: meta.title,
      description: meta.description,
      bio: meta.description,
      followersHint: '',
      textSample:
        textSample.length >= 40
          ? textSample.slice(0, 14000)
          : [
              `Perfil social para análise de conformidade.`,
              `Plataforma: ${platform}`,
              username ? `Username: @${username}` : '',
              `URL: ${meta.finalUrl}`,
              `Conteúdo público limitado na coleta automática.`,
            ]
              .filter(Boolean)
              .join('\n'),
      summary: '',
      collectionNotes: notes,
    };

    evidence.summary = [
      `Plataforma: ${platform}`,
      `URL: ${evidence.finalUrl}`,
      `Username: ${username ? `@${username}` : 'n/d'}`,
      `Título: ${meta.title || 'n/d'}`,
      `Descrição: ${meta.description || 'n/d'}`,
      notes.length ? `Notas: ${notes.join(' | ')}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return evidence;
  } catch (err) {
    const username = usernameFromUrl;
    notes.push(`Fallback HTML falhou: ${err instanceof Error ? err.message : 'erro'}`);
    const finalUrl =
      platform === 'instagram' && username
        ? `https://www.instagram.com/${username}/`
        : normalized;

    return {
      url: normalized,
      finalUrl,
      platform,
      username,
      title: username ? `@${username}` : '',
      description: '',
      bio: '',
      followersHint: '',
      textSample: [
        `Perfil social para análise de conformidade digital.`,
        `Plataforma: ${platform}`,
        username ? `Username informado: @${username}` : '',
        `URL: ${finalUrl}`,
        `A coleta automática do conteúdo falhou. Avaliar riscos típicos de perfis profissionais na plataforma (identificação do conselho, promessa de resultado, depoimentos, antes/depois, LGPD) e marcar limitações no internal_report.`,
      ]
        .filter(Boolean)
        .join('\n'),
      summary: [
        `Plataforma: ${platform}`,
        `URL: ${finalUrl}`,
        `Username: ${username ? `@${username}` : 'n/d'}`,
        `Coleta automática falhou.`,
        `Notas: ${notes.join(' | ')}`,
      ].join('\n'),
      collectionNotes: notes,
    };
  }
}
