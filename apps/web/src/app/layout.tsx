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

const nombre = process.env.NEXT_PUBLIC_APP_NAME ?? 'resto';

export const metadata: Metadata = {
  title: nombre,
  description: 'Caja en el celular, cocina y pantalla de pedidos listos para restaurantes.',
};

export const viewport: Viewport = {
  themeColor: '#0E4C7A',
};

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
