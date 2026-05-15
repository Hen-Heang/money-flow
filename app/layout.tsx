import type { Metadata, Viewport } from 'next'
import { Toaster } from 'react-hot-toast'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'

const geistSans = GeistSans
const geistMono = GeistMono

export const metadata: Metadata = {
  title: 'Money Flow',
  description: 'Personal finance tracker',
  icons: {
    icon: '/icon.png',
    apple: '/apple-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Money Flow',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0a0f1a' },
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Money Flow" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="preconnect" href="https://lqjjabfmaweztxkvfrsq.supabase.co" />
        <link rel="dns-prefetch" href="https://lqjjabfmaweztxkvfrsq.supabase.co" />
        {/* Theme init — runs before render to prevent flash */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var t = localStorage.getItem('theme');
            if (t === 'light') document.documentElement.classList.add('light');
          } catch(e) {}
        ` }} />
      </head>
      <body className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text-primary)]">
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: 'var(--color-card-elevated-base)',
              color: 'var(--color-text-primary)',
              borderRadius: '12px',
              border: '1px solid var(--color-border-base)',
            },
          }}
        />
      </body>
    </html>
  )
}
