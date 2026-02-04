import type { Metadata } from 'next';
import { Grandstander, Rubik, Amaranth, Playfair_Display } from 'next/font/google';
import { Toaster } from 'sonner';
import FooterWrapper from '@/components/shared/FooterWrapper';
import ErrorBoundary from '@/components/shared/ErrorBoundary';
import './globals.css';

// MiniMusiker Brand Fonts
const grandstander = Grandstander({
  subsets: ['latin'],
  weight: ['700'],
  variable: '--font-grandstander',
  display: 'swap',
});

const rubik = Rubik({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-rubik',
  display: 'swap',
});

const amaranth = Amaranth({
  subsets: ['latin'],
  weight: ['700'],
  variable: '--font-amaranth',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  style: ['italic'],
  weight: ['400', '600'],
  variable: '--font-playfair',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'MiniMusiker - School Music Event Platform',
  description: 'Manage school music events from notification to delivery',
  keywords: 'school music, event management, recordings, merchandise',
  authors: [{ name: 'MiniMusiker' }],
  openGraph: {
    title: 'MiniMusiker - School Music Event Platform',
    description: 'Manage school music events from notification to delivery',
    type: 'website',
    locale: 'en_US',
    url: process.env.NEXT_PUBLIC_APP_URL,
    siteName: 'MiniMusiker',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MiniMusiker - School Music Event Platform',
    description: 'Manage school music events from notification to delivery',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${rubik.variable} ${grandstander.variable} ${amaranth.variable} ${playfair.variable} ${rubik.className}`}>
        <ErrorBoundary>
          <div className="min-h-screen bg-background flex flex-col">
            <main className="flex-1">
              {children}
            </main>
            <FooterWrapper />
          </div>
        </ErrorBoundary>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'white',
              border: '1px solid #e5e7eb',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
            },
            className: 'font-sans',
          }}
          richColors
        />
      </body>
    </html>
  );
}