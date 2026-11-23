/**
 * Descobre perfis públicos a partir do HTML do site (igual à script do lote).
 * Não inventa perfil: só URLs encontradas no código.
 */

const SKIP: Record<string, string[]> = {
  instagram: ['/p/', '/reel', '/explore/', '/accounts/', '/stories/', '/tv/'],
  facebook: ['/sharer', '/share', '/dialog', '/plugins', '/login', '/watch', '/help', '/privacy', '/tr', '/tr?', '/ads/'],
  tiktok: ['/discover', '/login', '/tag/'],
  youtube: ['/watch', '/shorts', '/playlist', '/results'],
  linkedin: ['/feed', '/login', '/share', '/posts/'],
};

const HOSTS: Record<string, string[]> = {
  instagram: ['instagram.com'],
  facebook: ['facebook.com', 'fb.com'],
  tiktok: ['tiktok.com'],
  youtube: ['youtube.com', 'youtu.be'],
  linkedin: ['linkedin.com'],
};

function cleanUrl(raw: string, baseUrl: string): string {
  try {
    const abs = new URL(raw, baseUrl).toString();
    return abs.split('#')[0].replace(/\/$/, '') || abs;
  } catch {
    return '';
  }
}

function classify(raw: string, baseUrl: string): { network: string; url: string } | null {
  const url = cleanUrl(raw, baseUrl);
  if (!url || !/^https?:\/\//i.test(url)) return null;
  let host = '';
  let path = '';
  try {
    const u = new URL(url);
    host = u.hostname.replace(/^www\./i, '').toLowerCase();
    path = `${u.pathname}${u.search}`.toLowerCase();
  } catch {
    return null;
  }

  for (const [network, hosts] of Object.entries(HOSTS)) {
    if (!hosts.some((h) => host === h || host.endsWith(`.${h}`))) continue;
    if ((SKIP[network] || []).some((p) => path.includes(p))) return null;
    // perfil IG: precisa de username (não só /)
    if (network === 'instagram') {
      const parts = path.split('/').filter(Boolean);
      if (!parts.length) return null;
    }
    // Facebook pixel /tr
    if (network === 'facebook' && (path === '/tr' || path.startsWith('/tr?'))) return null;
    return { network, url };
  }
  return null;
}

export function extractSocialsFromHtml(html: string, baseUrl: string): Record<string, string> {
  const found: Record<string, string> = {};
  const blobs: string[] = [];

  const hrefRe = /(?:href|src)=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = hrefRe.exec(html || ''))) {
    blobs.push(m[1]);
  }
  const urlRe = /https?:\/\/[^\s"'<>]+/gi;
  while ((m = urlRe.exec(html || ''))) {
    blobs.push(m[0]);
  }

  for (const raw of blobs) {
    const hit = classify(raw, baseUrl);
    if (!hit) continue;
    if (!found[hit.network]) found[hit.network] = hit.url;
  }
  return found;
}

export function extractInstagramFromHtml(html: string, baseUrl: string): string {
  return extractSocialsFromHtml(html, baseUrl).instagram || '';
}
