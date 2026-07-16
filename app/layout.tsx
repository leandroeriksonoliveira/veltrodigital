import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Veltro Digital',
  description: 'Marketing digital, estrutura e conformidade para profissionais liberais.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
