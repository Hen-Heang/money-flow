import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { FALLBACK_EXCHANGE_RATE, EXCHANGE_RATE_CACHE_MINUTES } from '@/shared/presets'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()

    const cacheThreshold = new Date(Date.now() - EXCHANGE_RATE_CACHE_MINUTES * 60 * 1000).toISOString()
    const { data: cached } = await supabase
      .from('exchange_rates')
      .select('*')
      .eq('base_currency', 'USD')
      .eq('target_currency', 'KRW')
      .gte('fetched_at', cacheThreshold)
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
        rate: FALLBACK_EXCHANGE_RATE,
        base_currency: 'USD',
        target_currency: 'KRW',
        fetched_at: new Date().toISOString(),
        cached: false,
        fallback: true,
      })
    }

    const response = await fetch(`https://v6.exchangerate-api.com/v6/${apiKey}/pair/USD/KRW`, {
      next: { revalidate: 0 },
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('[exchange-rate] API error:', response.status, errText)
      return NextResponse.json({
        rate: FALLBACK_EXCHANGE_RATE,
        base_currency: 'USD',
        target_currency: 'KRW',
        fetched_at: new Date().toISOString(),
        error: true,
      })
    }

    const data = await response.json()

    if (data.result !== 'success') {
      console.error('[exchange-rate] API result not success:', data)
      return NextResponse.json({
        rate: FALLBACK_EXCHANGE_RATE,
        base_currency: 'USD',
        target_currency: 'KRW',
        fetched_at: new Date().toISOString(),
        error: true,
      })
    }

    const rate = data.conversion_rate
    const fetchedAt = new Date().toISOString()

    // Upsert so the table doesn't grow unbounded
    await supabase.from('exchange_rates').upsert(
      { base_currency: 'USD', target_currency: 'KRW', rate, fetched_at: fetchedAt },
      { onConflict: 'base_currency,target_currency' }
    )

    return NextResponse.json({
      rate,
      base_currency: 'USD',
      target_currency: 'KRW',
      fetched_at: fetchedAt,
      cached: false,
    })
  } catch (err) {
    console.error('[exchange-rate] Caught error:', err)
    return NextResponse.json({
      rate: FALLBACK_EXCHANGE_RATE,
      base_currency: 'USD',
      target_currency: 'KRW',
      fetched_at: new Date().toISOString(),
      error: true,
    })
  }
}
