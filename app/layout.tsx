import type { Metadata, Viewport } from 'next'
import { Toaster } from 'sonner'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'
import React from "react";

const geistSans = GeistSans
const geistMono = GeistMono

export const metadata: Metadata = {
  title: {
    default: 'Money Flow',
    template: '%s · Money Flow',
  },
  description: 'Track spending, plan budgets, and make steady progress toward your savings goals.',
  manifest: '/manifest.webmanifest',
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

// Read directly (not via lib/env/client's throwing accessor) — this is a best-effort
// resource hint rendered in the root layout for every route, so a missing/invalid
// URL should silently drop the hint rather than fail the entire app shell.
function supabaseOrigin(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return null
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabaseUrl = supabaseOrigin()

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
        {supabaseUrl && (
          <>
            <link rel="preconnect" href={supabaseUrl} />
            <link rel="dns-prefetch" href={supabaseUrl} />
          </>
        )}
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
