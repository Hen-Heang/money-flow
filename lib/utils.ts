import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatKRW(amount: number): string {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatNumber(amount: number): string {
  return new Intl.NumberFormat('ko-KR').format(amount)
}

export const haptic = (style: 'light' | 'medium' | 'heavy' = 'light') => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(style === 'light' ? 10 : style === 'medium' ? 20 : 30)
  }
}

export function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function getDisplayName(email?: string | null, displayName?: string | null): string {
  if (displayName?.trim()) return displayName.trim()
  if (email) return email.split('@')[0]
  return 'there'
}

export function getInitials(name?: string | null): string {
  if (!name?.trim()) return '?'

  const parts = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)

  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('')
}

export async function resizeImageToDataUrl(file: File, size = 256, quality = 0.82): Promise<string> {
  const imageUrl = URL.createObjectURL(file)

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = imageUrl
    })

    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size

    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Canvas is not available')
    }

    const sourceSize = Math.min(image.width, image.height)
    const sourceX = (image.width - sourceSize) / 2
    const sourceY = (image.height - sourceSize) / 2

    context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size)

    return canvas.toDataURL('image/jpeg', quality)
  } finally {
    URL.revokeObjectURL(imageUrl)
  }
}
