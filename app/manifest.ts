import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Money Flow',
    short_name: 'MoneyFlow',
    description: 'Personal finance tracker — track spending, savings goals, and budgets',
    lang: 'en',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#070b14',
    theme_color: '#070b14',
    orientation: 'portrait',
    categories: ['finance', 'productivity'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Add Transaction',
        short_name: 'Add',
        description: 'Quickly log a new transaction',
        url: '/transactions?action=add',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'Savings Goals',
        short_name: 'Savings',
        description: 'View and update savings goals',
        url: '/savings',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'Analytics',
        short_name: 'Analytics',
        description: 'View spending analytics',
        url: '/analytics',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
    ],
  }
}
