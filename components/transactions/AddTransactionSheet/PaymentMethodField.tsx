import { Controller, type Control } from 'react-hook-form'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select'
import type { TransactionFormData } from '@/hooks/useTransactionForm'
import type { PaymentMethod } from '@/lib/types'

export function PaymentMethodField({
  control,
  paymentMethods,
  inputBaseStyle,
}: {
  control: Control<TransactionFormData>
  paymentMethods: PaymentMethod[]
  inputBaseStyle: string
}) {
  return (
    <Controller
      control={control}
      name="payment_method_id"
      render={({ field }) => (
        <Select value={field.value || '__none__'} onValueChange={v => field.onChange(v === '__none__' ? '' : v)}>
          <SelectTrigger className={inputBaseStyle} aria-label="Payment Method">
            <SelectValue placeholder="Payment Method" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">No method</SelectItem>
            {paymentMethods.map(m => (
              <SelectItem key={m.id} value={m.id}>{m.icon} {m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  )
}
