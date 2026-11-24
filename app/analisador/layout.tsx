import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nota de Conformidade Digital | Veltro Digital',
  description:
    'Seu site está em conformidade? Faça uma análise inicial da sua presença digital, no site e nas redes, e veja a nota, os pontos de atenção, o que pode precisar de ajuste e como evitar penalidades.',
}

export default function AnalisadorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
