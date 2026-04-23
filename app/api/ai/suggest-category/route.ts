import { google } from '@ai-sdk/google'
import { generateText } from 'ai'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { rateLimit } from '@/lib/rate-limit'

const DEFAULT_GEMINI_MODEL = process.env.GOOGLE_GENERATIVE_AI_MODEL || 'gemini-1.5-flash'

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return new Response('Unauthorized', { status: 401 })

  const { allowed } = rateLimit(`ai-suggest:${user.id}`, 30, 60_000)
  if (!allowed) return new Response(JSON.stringify({ categoryId: null }), { status: 200 })

  const { description, type, categories } = await req.json()

  if (!description || !categories || !Array.isArray(categories)) {
    return new Response('Missing required fields', { status: 400 })
  }

  // Filter categories by type (income/expense)
  const availableCategories = categories
    .filter(c => c.type === type || c.type === 'both')
    .map(c => ({ id: c.id, name: c.name }))

  if (availableCategories.length === 0) {
    return new Response(JSON.stringify({ categoryId: null }), { status: 200 })
  }

  try {
    const { text } = await generateText({
      model: google(DEFAULT_GEMINI_MODEL),
      system: `You are a financial assistant for a money tracking app. 
      Your task is to categorize a user's transaction based on its description.
      Available categories: ${JSON.stringify(availableCategories)}
      Return ONLY the "id" of the most likely category. 
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
    return new Response(JSON.stringify({ categoryId: null }), { status: 200 })
  }
}
