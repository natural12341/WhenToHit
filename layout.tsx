import type { Metadata, Viewport } from 'next';
import './globals.css';
import { StoreProvider } from '@/lib/store';
import Shell from '@/components/Shell';

export const metadata: Metadata = {
  title: 'Цикл',
  description: 'Календарь циклов',
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: 'Цикл', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#100d14' },
    { media: '(prefers-color-scheme: light)', color: '#faf7fb' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <StoreProvider>
          <Shell>{children}</Shell>
        </StoreProvider>
      </body>
    </html>
  );
}
