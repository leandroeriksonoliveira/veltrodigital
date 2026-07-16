import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Analisador de Conformidade Digital | Veltro Digital',
  description:
    'Avalie bio, posts ou site institucional com base em LGPD, Marco Civil e normas do seu conselho de classe.',
};

export default function AnalisadorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
