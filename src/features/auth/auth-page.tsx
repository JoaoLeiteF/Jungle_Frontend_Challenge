import { useState, useSyncExternalStore } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { loginInputSchema, registerInputSchema, type LoginInput, type RegisterInput } from '@/api/contracts'
import { session } from '@/app/session'
import { applyApiErrors, Field, FormAlert } from '@/components/field'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Hero } from '@/features/catalog/home-page'
import { cn } from '@/lib/utils'

type Mode = 'login' | 'register'

const mdQuery = typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)') : null
function useIsDesktop() {
  return useSyncExternalStore(
    (cb) => (mdQuery?.addEventListener('change', cb), () => mdQuery?.removeEventListener('change', cb)),
    () => mdQuery?.matches ?? true,
  )
}

function useFinish() {
  const navigate = useNavigate()
  const { redirect } = useSearch({ strict: false }) as { redirect?: string }
  return () => navigate({ to: redirect && redirect.startsWith('/') && !redirect.startsWith('/login') ? redirect : '/', replace: true })
}

function SocialButtons() {
  const [note, setNote] = useState(false)
  const btn = 'flex h-9 w-full items-center justify-center gap-2.5 rounded-[4px] border border-line-soft text-xs transition-[background-color,border-color,transform] duration-150 hover:border-sand-muted hover:bg-surface-raised active:scale-[0.98]'
  return (
    <div className="flex flex-col gap-3">
      <p className="text-center text-xs">Ou continue com</p>
      <button type="button" className={btn} onClick={() => setNote(true)}>
        <svg aria-hidden viewBox="0 0 48 48" className="size-4">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
        Continuar com Google
      </button>
      <button type="button" className={btn} onClick={() => setNote(true)}>
        <svg aria-hidden viewBox="0 0 24 24" className="size-4">
          <path fill="#1877F2" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.43c0-3.01 1.79-4.67 4.53-4.67 1.31 0 2.69.24 2.69.24v2.95h-1.51c-1.49 0-1.96.93-1.96 1.88v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.09 24 18.1 24 12.07z" />
          <path fill="#fff" d="m16.67 15.56.53-3.49h-3.33V9.83c0-.95.47-1.88 1.96-1.88h1.51V5s-1.37-.24-2.69-.24c-2.74 0-4.53 1.66-4.53 4.67v2.64H7.08v3.49h3.05V24a12.1 12.1 0 0 0 3.75 0v-8.44h2.79z" />
        </svg>
        Continuar com Facebook
      </button>
      <p role="status" className="min-h-4 text-center text-xs text-sand">
        {note ? 'Login social não está disponível nesta demonstração. Use e-mail e senha.' : ''}
      </p>
    </div>
  )
}

function DemoHint() {
  if (import.meta.env.VITE_ENABLE_MOCKS === 'false') return null
  return <p className="text-center text-[11px] text-sand-muted">Demonstração: ana@kurio.test ou bruno@kurio.test · senha Kurio@123</p>
}

function LoginForm() {
  const finish = useFinish()
  const form = useForm<LoginInput>({ resolver: zodResolver(loginInputSchema), defaultValues: { email: '', password: '' } })
  const [error, setError] = useState<string | null>(null)
  const submit = form.handleSubmit(async (values) => {
    setError(null)
    try {
      await session.login(values)
      finish()
    } catch (e) {
      setError(applyApiErrors(form, e))
    }
  })
  const { errors, isSubmitting } = form.formState
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <FormAlert message={error} />
      <Field label="E-mail" hideLabel type="email" autoComplete="email" placeholder="contato@email.com" error={errors.email} {...form.register('email')} />
      <Field label="Senha" hideLabel type="password" autoComplete="current-password" placeholder="Senha" error={errors.password} {...form.register('password')} />
      <Link to="/em-breve" search={{ secao: 'Recuperação de senha' }} className="self-end text-xs text-highlight hover:underline">
        Esqueceu a senha?
      </Link>
      <Button type="submit" loading={isSubmitting} className="h-10 text-sm max-md:h-12 max-md:text-base">
        {isSubmitting ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  )
}

function RegisterForm() {
  const finish = useFinish()
  const form = useForm<RegisterInput>({ resolver: zodResolver(registerInputSchema), defaultValues: { username: '', email: '', password: '', confirmPassword: '' } })
  const [error, setError] = useState<string | null>(null)
  const submit = form.handleSubmit(async (values) => {
    setError(null)
    try {
      await session.register(values)
      finish()
    } catch (e) {
      setError(applyApiErrors(form, e))
    }
  })
  const { errors, isSubmitting } = form.formState
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <FormAlert message={error} />
      <Field label="Nome de usuário" hideLabel autoComplete="username" placeholder="Nome de usuário" error={errors.username} {...form.register('username')} />
      <Field label="E-mail" hideLabel type="email" autoComplete="email" placeholder="Digite seu e-mail" error={errors.email} {...form.register('email')} />
      <Field label="Senha" hideLabel type="password" autoComplete="new-password" placeholder="Senha" hint="Mínimo de 8 caracteres, com letra e número." error={errors.password} {...form.register('password')} />
      <Field label="Confirmar senha" hideLabel type="password" autoComplete="new-password" placeholder="Confirmar senha" error={errors.confirmPassword} {...form.register('confirmPassword')} />
      <Button type="submit" loading={isSubmitting} className="h-10 text-sm max-md:h-12 max-md:text-base">
        {isSubmitting ? 'Criando…' : 'Criar conta'}
      </Button>
    </form>
  )
}

function ModeSwitch({ mode }: { mode: Mode }) {
  const search = useSearch({ strict: false }) as { redirect?: string }
  const cls = (on: boolean) => cn('hover:underline', on ? 'text-highlight' : 'text-cream')
  return (
    <nav aria-label="Entrar ou criar conta" className="text-center text-base font-bold">
      <Link to="/login" search={search} replace className={cls(mode === 'login')} aria-current={mode === 'login' ? 'page' : undefined}>
        Entrar
      </Link>
      <span className="mx-1 text-brand" aria-hidden>
        |
      </span>
      <Link to="/register" search={search} replace className={cls(mode === 'register')} aria-current={mode === 'register' ? 'page' : undefined}>
        Criar conta
      </Link>
    </nav>
  )
}

function AuthScreen({ mode }: { mode: Mode }) {
  const desktop = useIsDesktop()
  const navigate = useNavigate()
  const expired = session.get().status === 'anonymous' && 'expired' in session.get()
  const intro = mode === 'login' ? 'Entre para gerenciar sua carteira, coleção e perfil de criador.' : 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.'
  const body = (
    <div className="flex flex-col gap-5">
      {expired && mode === 'login' && <FormAlert message="Sua sessão expirou. Entre novamente — você voltará para onde estava." />}
      {mode === 'login' ? <LoginForm /> : <RegisterForm />}
      <SocialButtons />
      <DemoHint />
    </div>
  )

  if (desktop)
    return (
      <>
        <div aria-hidden inert>
          <Hero />
        </div>
        <Dialog open onOpenChange={(open) => !open && navigate({ to: '/' })}>
          <DialogContent className="w-[333px] border-0 border-b-[6px] border-b-brand bg-surface-card px-8 py-8 sm:max-w-[333px]">
            <DialogTitle asChild>
              <div>
                <ModeSwitch mode={mode} />
              </div>
            </DialogTitle>
            <DialogDescription className="text-center text-[11px] leading-4 text-cream">{intro}</DialogDescription>
            {body}
          </DialogContent>
        </Dialog>
      </>
    )

  return (
    <section className="mx-auto flex min-h-[100dvh] max-w-sm flex-col justify-center gap-8 py-10" aria-labelledby="auth-title">
      <p className="text-center text-3xl font-bold tracking-[0.1em]">KURIO</p>
      <h1 id="auth-title" className="text-center text-lg font-bold">
        {mode === 'login' ? 'Entrar' : 'Criar perfil de colecionador'}
      </h1>
      {body}
      <p className="text-center text-sm">
        {mode === 'login' ? (
          <>
            Novo na Kurio?{' '}
            <Link to="/register" search={(s) => s} className="text-highlight">
              Crie uma conta
            </Link>
          </>
        ) : (
          <>
            Já tem uma conta?{' '}
            <Link to="/login" search={(s) => s} className="text-highlight">
              Entre
            </Link>
          </>
        )}
      </p>
    </section>
  )
}

export const LoginPage = () => <AuthScreen mode="login" />
export const RegisterPage = () => <AuthScreen mode="register" />
