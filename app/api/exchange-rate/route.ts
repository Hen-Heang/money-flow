import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()

    // Check cache (less than 15 minutes old)
    const oneHourAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()
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

    // SSL bypass for corporate networks
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

    const response = await fetch(`https://v6.exchangerate-api.com/v6/${apiKey}/pair/USD/KRW`, {
      next: { revalidate: 0 },
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('[exchange-rate] API error:', response.status, errText)
      return NextResponse.json({
        rate: 1300,
        base_currency: 'USD',
        target_currency: 'KRW',
        fetched_at: new Date().toISOString(),
        error: true,
        error_detail: `API ${response.status}: ${errText.slice(0, 200)}`,
      })
    }

    const data = await response.json()

    if (data.result !== 'success') {
      console.error('[exchange-rate] API result not success:', data)
      return NextResponse.json({
        rate: 1300,
        base_currency: 'USD',
        target_currency: 'KRW',
        fetched_at: new Date().toISOString(),
        error: true,
        error_detail: data['error-type'] ?? 'Unknown API error',
      })
    }

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
  } catch (err) {
    console.error('[exchange-rate] Caught error:', err)
    return NextResponse.json({
      rate: 1300,
      base_currency: 'USD',
      target_currency: 'KRW',
      fetched_at: new Date().toISOString(),
      error: true,
      error_detail: String(err),
    })
  }
}
