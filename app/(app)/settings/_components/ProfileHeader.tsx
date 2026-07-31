'use client'

import { useState, useRef, type ChangeEvent } from 'react'
import { toast } from 'sonner'
import { Camera, Check, Pencil, X } from 'lucide-react'
import { useSupabaseClient } from '@/hooks/useSupabaseClient'
import Avatar from '@/components/ui/Avatar'
import { getDisplayName, resizeImageToBlob } from '@/lib/utils'
import type { UserProfile } from '../_types'

export function ProfileHeader({ profile, setProfile }: {
  profile: UserProfile | null
  setProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>
}) {
  const supabase = useSupabaseClient()
  const [isEditingName, setIsEditingName] = useState(false)
  const [editingDisplayName, setEditingDisplayName] = useState('')
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    setIsUploadingAvatar(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) throw new Error('You are not signed in')

      const blob = await resizeImageToBlob(file, 256, 0.82)
      const path = `${user.id}/avatar.jpg`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(path)

      // Bust the CDN cache so the new image loads immediately
      const avatarUrl = `${publicUrl}?t=${Date.now()}`

      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: avatarUrl })
        .eq('id', user.id)

      if (updateError) throw updateError

      setProfile((current) => current ? { ...current, avatar_url: avatarUrl } : current)
      toast.success('Profile photo updated')
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to update photo')
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const saveDisplayName = async () => {
    const name = editingDisplayName.trim()
    if (!name) { toast.error('Name cannot be empty'); return }
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return
    const { error } = await supabase.from('users').update({ display_name: name }).eq('id', user.id)
    if (error) { toast.error('Failed to update name'); return }
    setProfile(prev => prev ? { ...prev, display_name: name } : prev)
    setIsEditingName(false)
    toast.success('Name updated')
  }

  return (
    <div className="flex flex-col items-center text-center mb-10 pt-4">
      <div className="relative mb-4 group">
        <Avatar
          src={profile?.avatar_url}
          name={getDisplayName(profile?.email, profile?.display_name)}
          size={100}
          className="ring-4 ring-white/10 shadow-2xl transition-transform group-active:scale-95"
        />
        <button
          onClick={() => avatarInputRef.current?.click()}
          disabled={isUploadingAvatar}
          className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-[var(--color-accent-base)] border-4 border-[var(--color-bg)] flex items-center justify-center text-white shadow-lg active:scale-90 transition-all disabled:opacity-50"
        >
          <Camera size={16} strokeWidth={2.5} />
        </button>
        <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
      </div>
      {isEditingName ? (
        <div className="flex items-center gap-2 mt-1">
          <input
            autoFocus
            value={editingDisplayName}
            onChange={e => setEditingDisplayName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveDisplayName(); if (e.key === 'Escape') setIsEditingName(false) }}
            className="bg-[var(--color-card-base)] border-2 border-[var(--color-accent-base)] rounded-xl px-4 py-2 text-lg font-black text-center outline-none"
            placeholder="Your name"
          />
          <button onClick={saveDisplayName} className="w-9 h-9 rounded-xl bg-[var(--color-income-base)] flex items-center justify-center text-white"><Check size={16} strokeWidth={3} /></button>
          <button onClick={() => setIsEditingName(false)} className="w-9 h-9 rounded-xl bg-[var(--color-card-base)] border border-[var(--color-border-base)] flex items-center justify-center"><X size={16} /></button>
        </div>
      ) : (
        <div className="flex items-center gap-2 mt-1">
          <h1 className="text-2xl font-black tracking-tight">{getDisplayName(profile?.email, profile?.display_name)}</h1>
          <button
            onClick={() => { setEditingDisplayName(profile?.display_name || ''); setIsEditingName(true) }}
            className="p-1.5 rounded-lg bg-[var(--color-card-elevated-base)] text-[var(--color-text-secondary)]"
          >
            <Pencil size={13} strokeWidth={2.5} />
          </button>
        </div>
      )}
      <p className="text-[13px] font-bold opacity-50 uppercase tracking-widest mt-1.5">{profile?.email}</p>

      <div className="mt-4 flex gap-2">
         <span className="px-3 py-1 rounded-full bg-[var(--color-card-elevated-base)] border border-[var(--color-border-base)] text-[10px] font-black uppercase tracking-widest opacity-70">
           {profile?.default_currency || 'KRW'} User
         </span>
         <span className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-black uppercase tracking-widest text-blue-400">
           Pro Account
         </span>
      </div>
    </div>
  )
}
