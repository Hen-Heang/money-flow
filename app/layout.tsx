import type { Metadata, Viewport } from 'next'
import { Toaster } from 'sonner'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'

const geistSans = GeistSans
const geistMono = GeistMono

export const metadata: Metadata = {
  title: {
    default: 'Money Flow',
    template: '%s · Money Flow',
  },
  description: 'Track spending, plan budgets, and make steady progress toward your savings goals.',
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
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#070b14' },
    { media: '(prefers-color-scheme: light)', color: '#f4f7fb' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      suppressHydrationWarning
    >
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
        <a href="#main-content" className="skip-link">Skip to main content</a>
        {children}
        <Toaster
          position="bottom-center"
          theme="system"
          richColors
          closeButton
          toastOptions={{
            style: {
              fontFamily: 'var(--font-geist-sans)',
            },
          }}
        />
      </body>
    </html>
  )
}
