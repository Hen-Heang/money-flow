import { neon } from '@neondatabase/serverless'

// Strip channel_binding param — not supported by the serverless HTTP driver
const rawUrl = process.env.NEON_DATABASE_URL!
const cleanUrl = rawUrl.replace(/[?&]channel_binding=[^&]*/g, '').replace(/\?$/, '')

const sql = neon(cleanUrl)

export default sql
