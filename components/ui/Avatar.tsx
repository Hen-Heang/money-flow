'use client'

import { getInitials } from '@/lib/utils'

interface AvatarProps {
  src?: string | null
  name?: string | null
  size?: number
  className?: string
}

export default function Avatar({ src, name, size = 48, className = '' }: AvatarProps) {
  const initials = getInitials(name)

  return (
    <div
      className={`overflow-hidden rounded-full ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        background: src
          ? 'transparent'
          : 'linear-gradient(135deg, rgba(16,185,129,0.9), rgba(59,130,246,0.9))',
      }}
    >
      {src ? (
        <img
          src={src}
          alt={name ? `${name} avatar` : 'User avatar'}
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center font-semibold text-white"
          style={{ fontSize: `${Math.max(Math.round(size * 0.34), 14)}px` }}
        >
          {initials}
        </div>
      )}
    </div>
  )
}
