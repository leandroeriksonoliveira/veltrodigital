import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: '/', destination: '/index.html' },
      { source: '/medicos', destination: '/medicos.html' },
      { source: '/advogados', destination: '/advogados.html' },
      { source: '/esporte', destination: '/esporte.html' },
      { source: '/arquitetura', destination: '/arquitetura.html' },
      { source: '/academias', destination: '/esporte.html' },
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
