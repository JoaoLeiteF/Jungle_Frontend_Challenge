import { useId, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import type { FieldError, FieldValues, Path, UseFormReturn } from 'react-hook-form'
import { isApiError } from '@/api/client'
import { cn } from '@/lib/utils'

export const inputClass =
  'h-10 w-full rounded-[4px] border border-line-soft bg-transparent px-3 text-sm placeholder:text-sand-muted focus-visible:border-highlight aria-invalid:border-danger disabled:opacity-60'

type FieldProps = Omit<React.ComponentProps<'input'>, 'id'> & {
  label: string
  error?: FieldError | string
  hint?: string
  required?: boolean
  hideLabel?: boolean
}

/** Label + input + error wired with aria-invalid/aria-describedby. Password fields get a show/hide toggle. */
export function Field({ label, error, hint, required, hideLabel, className, type = 'text', ...input }: FieldProps) {
  const id = useId()
  const [show, setShow] = useState(false)
  const message = typeof error === 'string' ? error : error?.message
  const describedBy = [message && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined
  const isPassword = type === 'password'
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={id} className={cn('text-sm', hideLabel && 'sr-only')}>
        {label}
        {required && (
          <span className="text-coral" aria-hidden>
            *
          </span>
        )}
      </label>
      <div className="relative">
        <input id={id} type={isPassword && show ? 'text' : type} aria-invalid={!!message} aria-describedby={describedBy} aria-required={required} className={cn(inputClass, isPassword && 'pr-10')} {...input} />
        {isPassword && (
          <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={show} className="absolute inset-y-0 right-0 grid w-10 place-items-center text-sand hover:text-cream">
            {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        )}
      </div>
      {hint && !message && (
        <p id={`${id}-hint`} className="text-xs text-sand">
          {hint}
        </p>
      )}
      {message && (
        <p id={`${id}-error`} className="text-xs text-danger">
          {message}
        </p>
      )}
    </div>
  )
}

/** Copies API field errors (400/409 `fields`) onto the form; returns the general message for the banner. */
export function applyApiErrors<T extends FieldValues>(form: UseFormReturn<T>, error: unknown): string {
  if (!isApiError(error)) return 'Erro inesperado. Tente novamente.'
  for (const [name, message] of Object.entries(error.fields ?? {})) form.setError(name as Path<T>, { type: 'server', message }, { shouldFocus: true })
  return error.message
}

export function FormAlert({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-[4px] border border-danger/50 bg-danger/10 px-3 py-2 text-sm text-danger">
      {message}
    </p>
  )
}
