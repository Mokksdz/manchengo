import type { Metadata } from 'next';
import { Manrope, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { SkipToContent } from '@/components/ui/skip-to-content';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
  preload: true,
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  preload: true,
});

export const metadata: Metadata = {
  title: 'Manchengo Smart ERP - Admin',
  description: 'Central administration for Manchengo Smart ERP',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${manrope.variable} ${spaceGrotesk.variable} font-body`}>
        <SkipToContent />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
