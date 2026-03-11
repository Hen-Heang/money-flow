import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()

    // Check cache (less than 1 hour old)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { data: cached } = await supabase
      .from('exchange_rates')
      .select('*')
      .eq('base_currency', 'USD')
      .eq('target_currency', 'KRW')
      .gte('fetched_at', oneHourAgo)
      .order('fetched_at', { ascending: false })
      .limit(1)
      .single()

    if (cached) {
      return NextResponse.json({
        rate: cached.rate,
        base_currency: 'USD',
        target_currency: 'KRW',
        fetched_at: cached.fetched_at,
        cached: true,
      })
    }

    // Fetch fresh rate
    const apiKey = process.env.EXCHANGE_RATE_API_KEY
    if (!apiKey || apiKey === 'YOUR_EXCHANGE_RATE_API_KEY') {
      return NextResponse.json({
        rate: 1300,
        base_currency: 'USD',
        target_currency: 'KRW',
        fetched_at: new Date().toISOString(),
        cached: false,
        fallback: true,
      })
    }

    const response = await fetch(`https://v6.exchangerate-api.com/v6/${apiKey}/pair/USD/KRW`)
    const data = await response.json()
    const rate = data.conversion_rate
    const fetchedAt = new Date().toISOString()

    // Store in cache
    await supabase.from('exchange_rates').insert({
      base_currency: 'USD',
      target_currency: 'KRW',
      rate,
      fetched_at: fetchedAt,
    })

    return NextResponse.json({
      rate,
      base_currency: 'USD',
      target_currency: 'KRW',
      fetched_at: fetchedAt,
      cached: false,
    })
  } catch {
    return NextResponse.json({
      rate: 1300,
      base_currency: 'USD',
      target_currency: 'KRW',
      fetched_at: new Date().toISOString(),
      error: true,
    })
  }
}
