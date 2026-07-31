import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationsDirectory = join(process.cwd(), 'supabase', 'migrations')
const migrations = readdirSync(migrationsDirectory)
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .map((file) => ({
    file,
    sql: readFileSync(join(migrationsDirectory, file), 'utf8'),
  }))

describe('Supabase migration security', () => {
  it('removes the unused privileged seed RPC after its legacy definition', () => {
    const createIndex = migrations.findIndex(({ sql }) =>
      /create\s+or\s+replace\s+function\s+public\.seed_default_user_data\s*\(\s*p_user_id\s+uuid\s*\)/i.test(sql),
    )
    const dropIndex = migrations.findLastIndex(({ sql }) =>
      /drop\s+function\s+if\s+exists\s+public\.seed_default_user_data\s*\(\s*uuid\s*\)/i.test(sql),
    )

    expect(createIndex).toBeGreaterThanOrEqual(0)
    expect(dropIndex).toBeGreaterThan(createIndex)
    const executableSql = migrations[dropIndex].sql.replace(/--.*$/gm, '')
    expect(executableSql).not.toMatch(/\bcascade\b/i)

    const laterSql = migrations
      .slice(dropIndex + 1)
      .map(({ sql }) => sql)
      .join('\n')

    expect(laterSql).not.toMatch(
      /create\s+or\s+replace\s+function\s+public\.seed_default_user_data/i,
    )
  })
})
