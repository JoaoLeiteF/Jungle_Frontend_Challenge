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
  const btn = 'flex h-9 w-full items-center justify-center gap-2 rounded-[4px] border border-line-soft text-xs hover:bg-surface-raised'
  return (
    <div className="flex flex-col gap-3">
      <p className="text-center text-xs">Ou continue com</p>
      {/* Social login is outside the challenge scope: it says so instead of pretending to authenticate. */}
      <button type="button" className={btn} onClick={() => setNote(true)}>
        <span aria-hidden className="font-bold text-[#4285F4]">
          G
        </span>
        Continuar com Google
      </button>
      <button type="button" className={btn} onClick={() => setNote(true)}>
        <span aria-hidden className="font-bold text-[#1877F2]">
          f
        </span>
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
      <Button type="submit" disabled={isSubmitting} className="h-10 text-sm max-md:h-12 max-md:text-base">
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
      <Button type="submit" disabled={isSubmitting} className="h-10 text-sm max-md:h-12 max-md:text-base">
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
        {/* Figma: the auth modal floats over the home hero; the footer stays below the scrim */}
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
