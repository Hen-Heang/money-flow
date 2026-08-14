import { requireUser } from '@/lib/server/auth'
import type { AIProvider } from '@/lib/ai-provider'

export async function POST(req: Request) {
  const { user, supabase } = await requireUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { provider } = await req.json() as { provider: AIProvider }
  if (provider !== 'openai' && provider !== 'gemini' && provider !== 'ling') {
    return new Response('Invalid provider', { status: 400 })
  }

  const { error } = await supabase
    .from('users')
    .update({ ai_provider: provider })
    .eq('id', user.id)

  if (error) return new Response('Failed to update', { status: 500 })
  return new Response('OK')
}