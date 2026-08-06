import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // App Contabilidade (projeto Vercel separado, serve na raiz)
      {
        source: '/contabilidade',
        destination: 'https://veltro-contabilidade.vercel.app/',
      },
      {
        source: '/contabilidade/:path*',
        destination: 'https://veltro-contabilidade.vercel.app/:path*',
      },
      { source: '/', destination: '/index.html' },
      { source: '/medicos', destination: '/medicos.html' },
      { source: '/advogados', destination: '/advogados.html' },
      { source: '/esporte', destination: '/esporte.html' },
      { source: '/arquitetura', destination: '/arquitetura.html' },
      { source: '/academias', destination: '/esporte.html' },
      { source: '/solucoes', destination: '/solucoes.html' },
      { source: '/solucoes/marmocloud', destination: '/solucoes/marmocloud.html' },
      { source: '/solucoes/notas-inteligentes', destination: '/solucoes/notas-inteligentes.html' },
      { source: '/solucoes/vitorino-advocacia', destination: '/solucoes/vitorino-advocacia.html' },
      { source: '/solucoes/granja-digital', destination: '/solucoes/granja-digital.html' },
      { source: '/solucoes/livia', destination: '/solucoes/livia.html' },
      { source: '/solucoes/associacoes', destination: '/solucoes/associacoes.html' },
      { source: '/solucoes/conformidade', destination: '/solucoes/conformidade.html' },
      { source: '/politica-de-privacidade', destination: '/politica-de-privacidade.html' },
      { source: '/termos-de-uso', destination: '/termos-de-uso.html' },
      { source: '/lgpd', destination: '/lgpd.html' },
    ];
  },
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'veltrodigital.com.br' }],
        destination: 'https://www.veltrodigital.com.br/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
