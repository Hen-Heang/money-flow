import { generateText, Output } from 'ai'
import { z } from 'zod'
import {
  getAIProviderOptions,
  getFastModel,
  withAIProviderFallback,
  type AIProvider,
} from '@/lib/ai-provider'
import type { Category, PaymentMethod, TransactionPreview } from '@/lib/types'

const transactionPreviewSchema = z.object({
  amount: z.number().positive(),
  currency: z.enum(['KRW', 'USD']),
  type: z.enum(['income', 'expense']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().trim().min(1).max(120),
  categoryId: z.string().nullable(),
  paymentMethodId: z.string().nullable(),
  note: z.string().trim().max(300).nullable(),
  confidence: z.number().min(0).max(1),
})

interface ParseTransactionInput {
  text: string
  today: string
  categories: Array<Pick<Category, 'id' | 'name' | 'type'>>
  paymentMethods: Array<Pick<PaymentMethod, 'id' | 'name'>>
  preferredProvider: AIProvider
  userId: string
}

function compactCategory(category: Pick<Category, 'id' | 'name' | 'type'>) {
  return { id: category.id, name: category.name, type: category.type }
}

function compactPaymentMethod(method: Pick<PaymentMethod, 'id' | 'name'>) {
  return { id: method.id, name: method.name }
}

function isValidDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export async function parseTransactionText(input: ParseTransactionInput): Promise<TransactionPreview> {
  const categoryIds = new Set(input.categories.map(category => category.id))
  const paymentMethodIds = new Set(input.paymentMethods.map(method => method.id))

  const { result } = await withAIProviderFallback(input.preferredProvider, async provider => {
    const response = await generateText({
      model: getFastModel(provider),
      output: Output.object({ schema: transactionPreviewSchema }),
      providerOptions: getAIProviderOptions(provider, input.userId),
      system: `You convert one short money-tracking note into a transaction preview.
Today is ${input.today}. Resolve relative dates against that date.
Use KRW unless the user explicitly indicates USD or dollars.
Use expense unless the text clearly describes income, salary, a refund received, or money coming in.
Choose categoryId and paymentMethodId only from the supplied IDs. Use null when uncertain.
Keep description short and useful. Put extra context in note. Never invent an amount.`,
      prompt: JSON.stringify({
        text: input.text,
        categories: input.categories.map(compactCategory),
        paymentMethods: input.paymentMethods.map(compactPaymentMethod),
      }),
    })

    return response.output
  })

  if (!isValidDate(result.date)) throw new Error('AI returned an invalid transaction date')

  return {
    ...result,
    categoryId: result.categoryId && categoryIds.has(result.categoryId) ? result.categoryId : null,
    paymentMethodId: result.paymentMethodId && paymentMethodIds.has(result.paymentMethodId)
      ? result.paymentMethodId
      : null,
    note: result.note?.trim() || null,
    description: result.description.trim(),
  }
}

interface TransactionHistoryRow {
  description: string
  type: 'income' | 'expense'
  category_id: string | null
  payment_method_id: string | null
}

function mostFrequent(values: Array<string | null>): string | null {
  const counts = new Map<string, number>()
  for (const value of values) {
    if (value) counts.set(value, (counts.get(value) || 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null
}

export function applyLearnedTransactionDefaults(
  preview: TransactionPreview,
  history: TransactionHistoryRow[],
  validCategoryIds: Set<string>,
  validPaymentMethodIds: Set<string>
): TransactionPreview {
  const normalizedDescription = preview.description.trim().toLocaleLowerCase()
  const matches = history.filter(row =>
    row.type === preview.type && row.description.trim().toLocaleLowerCase() === normalizedDescription
  )

  if (matches.length === 0) return preview

  const learnedCategoryId = mostFrequent(matches.map(row => row.category_id))
  const learnedPaymentMethodId = mostFrequent(matches.map(row => row.payment_method_id))

  return {
    ...preview,
    categoryId: learnedCategoryId && validCategoryIds.has(learnedCategoryId)
      ? learnedCategoryId
      : preview.categoryId,
    paymentMethodId: learnedPaymentMethodId && validPaymentMethodIds.has(learnedPaymentMethodId)
      ? learnedPaymentMethodId
      : preview.paymentMethodId,
  }
}
