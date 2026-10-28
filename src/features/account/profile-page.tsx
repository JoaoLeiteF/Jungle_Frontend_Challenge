import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { passwordInputSchema, profileInputSchema, type PasswordInput, type ProfileInput } from '@/api/contracts'
import { applyApiErrors, Field, FormAlert } from '@/components/field'
import { ErrorState, Skeleton } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useChangePassword, useMe, useUpdateProfile } from './queries'

const MAX_AVATAR = 500 * 1024

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

function ProfileForm() {
  const me = useMe()
  const update = useUpdateProfile()
  const form = useForm<ProfileInput>({ resolver: zodResolver(profileInputSchema) })
  const [error, setError] = useState<string | null>(null)
  const [avatar, setAvatar] = useState<string | null | undefined>(undefined) // undefined = untouched
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (me.data)
      form.reset({ displayName: me.data.displayName, username: me.data.username, email: me.data.email, ensName: me.data.ensName ?? '', referralCode: me.data.referralCode ?? '' })
  }, [me.data, form])

  const submit = form.handleSubmit(async (values) => {
    setError(null)
    try {
      await update.mutateAsync({ ...values, ...(avatar !== undefined ? { avatarDataUrl: avatar } : {}) })
      setAvatar(undefined)
      toast.success('Perfil atualizado.')
    } catch (e) {
      setError(applyApiErrors(form, e))
    }
  })

  async function pick(file?: File) {
    setAvatarError(null)
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return setAvatarError('Use PNG, JPEG ou WebP.')
    if (file.size > MAX_AVATAR) return setAvatarError('A imagem deve ter até 500 KB.')
    setAvatar(await readAsDataUrl(file))
  }

  if (me.isError) return <ErrorState onRetry={() => me.refetch()} />
  if (!me.data) return <Skeleton className="h-80" />
  const shown = avatar === undefined ? me.data.avatarUrl : avatar
  const { errors, isSubmitting } = form.formState

  return (
    <form onSubmit={submit} noValidate aria-labelledby="profile-title" className="flex flex-col gap-5">
      <h1 id="profile-title" className="text-lg font-bold">
        Perfil do colecionador
      </h1>
      <FormAlert message={error} />
      <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2">
        <Field label="Nome de exibição" required error={errors.displayName} {...form.register('displayName')} />
        <Field label="Nome de usuário" required error={errors.username} {...form.register('username')} />
        <Field label="E-mail" type="email" required error={errors.email} {...form.register('email')} />
        <Field label="Nome ENS" hint="Sem o sufixo .eth" error={errors.ensName} {...form.register('ensName')} />
        <Field label="Código de indicação" error={errors.referralCode} {...form.register('referralCode')} />
        <div className="flex flex-col gap-2">
          <span className="text-sm" id="avatar-label">
            Avatar
          </span>
          <div className="flex items-center gap-4">
            {shown ? (
              <img src={shown} alt="Avatar atual" className="size-[50px] rounded-full object-cover" />
            ) : (
              <span className="grid size-[50px] place-items-center rounded-full bg-surface-raised" aria-label="Sem avatar">
                <ImageIcon className="size-5 text-sand" aria-hidden />
              </span>
            )}
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-labelledby="avatar-label" aria-describedby={avatarError ? 'avatar-error' : undefined} onChange={(e) => pick(e.target.files?.[0])} />
            <Button type="button" onClick={() => fileRef.current?.click()} className="h-[38px] px-5">
              Alterar
            </Button>
            {shown && (
              <button type="button" onClick={() => setAvatar(null)} className="text-sm hover:text-highlight">
                Remover
              </button>
            )}
          </div>
          {avatarError && (
            <p id="avatar-error" role="alert" className="text-xs text-danger">
              {avatarError}
            </p>
          )}
          {avatar !== undefined && <p className="text-xs text-sand">Salve para aplicar o novo avatar.</p>}
        </div>
      </div>
      <Button type="submit" disabled={isSubmitting} className="h-[38px] w-fit px-8">
        {isSubmitting ? 'Salvando…' : 'Salvar'}
      </Button>
    </form>
  )
}

function PasswordForm() {
  const change = useChangePassword()
  const form = useForm<PasswordInput>({ resolver: zodResolver(passwordInputSchema), defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' } })
  const [error, setError] = useState<string | null>(null)
  const submit = form.handleSubmit(async (values) => {
    setError(null)
    try {
      await change.mutateAsync(values)
      form.reset()
      toast.success('Senha alterada.')
    } catch (e) {
      setError(applyApiErrors(form, e))
    }
  })
  const { errors, isSubmitting } = form.formState
  return (
    <form onSubmit={submit} noValidate aria-labelledby="password-title" className="flex max-w-[420px] flex-col gap-5">
      <h2 id="password-title" className="font-bold">
        Alterar senha
      </h2>
      <FormAlert message={error} />
      <Field label="Senha atual" type="password" autoComplete="current-password" error={errors.currentPassword} {...form.register('currentPassword')} />
      <Field label="Nova senha" type="password" autoComplete="new-password" hint="Mínimo de 8 caracteres, com letra e número." error={errors.newPassword} {...form.register('newPassword')} />
      <Field label="Confirmar nova senha" type="password" autoComplete="new-password" error={errors.confirmPassword} {...form.register('confirmPassword')} />
      <Button type="submit" disabled={isSubmitting} className="h-[38px] w-fit px-8">
        {isSubmitting ? 'Alterando…' : 'Alterar senha'}
      </Button>
    </form>
  )
}

export function ProfilePage() {
  return (
    <div className="flex flex-col gap-12">
      <ProfileForm />
      <PasswordForm />
    </div>
  )
}
