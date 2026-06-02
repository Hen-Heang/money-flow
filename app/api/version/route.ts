import { NextResponse } from 'next/server'

const APP_VERSION = '1.2.0'

export async function GET() {
  return NextResponse.json({
    version: APP_VERSION,
    builtAt: new Date().toISOString(),
    ok: true,
  })
}
