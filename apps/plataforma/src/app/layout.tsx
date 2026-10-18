import { hojaDeEstilos } from '@resto/design-tokens';
import type { Metadata, Viewport } from 'next';
import { Nunito, Nunito_Sans } from 'next/font/google';
import type { ReactNode } from 'react';

import { SesionProvider } from '@/lib/sesion';

import './globals.css';

const titulo = Nunito({ subsets: ['latin'], weight: ['800'], variable: '--font-titulo' });
const interfaz = Nunito_Sans({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-interfaz',
});

export const metadata: Metadata = {
  title: 'resto · consola',
  description: 'Consola interna del equipo de resto.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#0E4C7A',
};

/** Consola de plataforma (docs/11_ESTRUCTURA_PROYECTO.md §5). */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-PE" className={`${titulo.variable} ${interfaz.variable}`}>
      <head>
        {/* Variables de los temas claro y noche (docs/09_DESIGN_SYSTEM.md §12). */}
        <style>{hojaDeEstilos()}</style>
      </head>
      <body className="min-h-dvh font-sans antialiased">
        <SesionProvider>{children}</SesionProvider>
      </body>
    </html>
  );
}
