import { generateText } from 'ai'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { rateLimit } from '@/lib/rate-limit'
import { getFastModel, resolveProvider, type AIProvider } from '@/lib/ai-provider'
import { CATEGORY_MATCH_GUIDANCE, formatCategoriesForPrompt } from '@/lib/categorize'

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return new Response('Unauthorized', { status: 401 })

  const { allowed } = rateLimit(`ai-suggest:${user.id}`, 30, 60_000)
  if (!allowed) return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429 })

  const { description, type, categories } = await req.json()

  if (!description || !categories || !Array.isArray(categories)) {
    return new Response('Missing required fields', { status: 400 })
  }

  // Filter categories by type (income/expense)
  const availableCategories = categories
    .filter(c => c.type === type || c.type === 'both')
    .map(c => ({ id: c.id, name: c.name, icon: c.icon }))

  if (availableCategories.length === 0) {
    return new Response(JSON.stringify({ categoryId: null }), { status: 200 })
  }

  try {
    const { data: userPref } = await supabase.from('users').select('ai_provider').eq('id', user.id).single()
    const provider = resolveProvider((userPref?.ai_provider as AIProvider) || 'gemini')
    const { text } = await generateText({
      model: getFastModel(provider),
      system: `You are a financial assistant for a money tracking app.
Your task is to categorize a user's transaction based on its description.

Available categories (id: name):
${formatCategoriesForPrompt(availableCategories)}

${CATEGORY_MATCH_GUIDANCE}

Return ONLY the "id" of the best-matching category from the list above.
If no category fits well, return "null".
Do not explain. Do not return anything else.`,
      prompt: `Description: "${description}" | Type: ${type}`,
    })

    const suggestedId = text.trim().replace(/['"]+/g, '')
    const exists = availableCategories.some(c => c.id === suggestedId)

    return new Response(JSON.stringify({ 
      categoryId: exists ? suggestedId : null 
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('AI Suggestion Error:', error)
    return new Response(JSON.stringify({ error: 'AI service unavailable' }), { status: 500 })
  }
}
