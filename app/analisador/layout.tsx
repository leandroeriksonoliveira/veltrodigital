import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nota de Conformidade Digital | Veltro Digital',
  description:
    'Informe seu site e um contato. Receba a nota inicial de conformidade e os riscos de multa — LGPD, Marco Civil e conselhos.',
}

export default function AnalisadorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
