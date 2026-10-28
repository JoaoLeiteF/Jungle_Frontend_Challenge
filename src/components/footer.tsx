import { useState } from 'react'
import { Wordmark } from '@/components/wordmark'
import { Link } from '@tanstack/react-router'
import { Icon, type FigmaIcon } from './icon'

const FEATURES = [
  { letter: 'W', title: 'Segurança da carteira', text: 'Proteja sua carteira e colecione arte digital verificada com confiança.' },
  { letter: 'C', title: 'Criadores em destaque', text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.' },
  { letter: 'D', title: 'Alertas de lançamentos', text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.' },
]

const soon = (secao: string) => ({ to: '/em-breve' as const, search: { secao } })
const COLUMNS: { title: string; links: { label: string; link: { to: string; search?: Record<string, string> } }[] }[] = [
  {
    title: 'Meu perfil',
    links: [
      { label: 'Meu perfil', link: { to: '/profile' } },
      { label: 'Minha coleção', link: soon('Minha coleção') },
      { label: 'Atividade', link: soon('Atividade') },
      { label: 'Estúdio do criador', link: soon('Estúdio do criador') },
      { label: 'Lista de interesse', link: { to: '/profile/favorites' } },
    ],
  },
  {
    title: 'Central de ajuda',
    links: ['Central de ajuda', 'Como comprar NFTs', 'Carteira e segurança', 'Política do mercado', 'Denunciar item'].map((l) => ({ label: l, link: soon(l) })),
  },
  {
    title: 'Coleções',
    links: [
      ['Arte digital', 'arte-digital'],
      ['Fotografia', 'fotografia'],
      ['Música', 'musica'],
      ['Arte 3D', 'arte-3d'],
      ['Utilidade', 'utilidade'],
    ].map(([label, c]) => ({ label: label!, link: { to: '/', search: { collections: c! } } })),
  },
]
const SOCIAL: { name: FigmaIcon; label: string }[] = [
  { name: 'facebook', label: 'Facebook' },
  { name: 'instagram', label: 'Instagram' },
  { name: 'twitter', label: 'Twitter' },
  { name: 'linkedin', label: 'LinkedIn' },
  { name: 'youtube', label: 'YouTube' },
]

function Newsletter() {
  const [sent, setSent] = useState(false)
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg leading-4 font-bold">Antecipe-se ao próximo lançamento</h2>
      <form
        className="mt-2 flex"
        onSubmit={(e) => {
          e.preventDefault()
          setSent(true)
        }}
      >
        <label htmlFor="newsletter" className="sr-only">
          E-mail para novidades
        </label>
        <input id="newsletter" type="email" required placeholder="digite seu e-mail..." className="h-10 min-w-0 flex-1 rounded-l-[4px] bg-surface-raised px-3 text-sm placeholder:text-sand-muted" />
        <button type="submit" className="h-10 rounded-r-[4px] bg-brand px-3 font-bold text-ink transition-[background-color,transform] hover:bg-brand-light active:scale-[0.97]">
          Enviar
        </button>
      </form>
      <p role="status" className="text-xs leading-5 text-sand">
        {sent ? 'Inscrições abrem em breve — guardamos sua intenção apenas nesta página.' : 'Receba lançamentos selecionados, histórias de criadores e novidades do mercado.'}
      </p>
    </div>
  )
}

export function Footer() {
  return (
    <footer className="mx-auto mt-24 max-w-[1200px] md:px-6 xl:px-0">
      <div className="bg-surface-card">
        <div className="grid gap-8 px-6 py-10 sm:grid-cols-2 md:px-8 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.letter} className="group/feat flex flex-col gap-3 lg:border-r lg:border-brand lg:pr-8">
              <span aria-hidden className="grid size-[74px] place-items-center rounded-full bg-brand text-xl font-bold text-ink shadow-[0_6px_16px_-6px_rgb(0_0_0/0.6)] transition-transform duration-300 ease-out group-hover/feat:-translate-y-1">
                {f.letter}
              </span>
              <h2 className="font-bold">{f.title}</h2>
              <p className="text-sm leading-[22px] text-sand">{f.text}</p>
            </div>
          ))}
          <div>
            <Newsletter />
          </div>
        </div>
        <div className="grid gap-x-8 gap-y-3 bg-surface-dark px-6 py-6 text-sm sm:grid-cols-2 md:px-8 lg:grid-cols-4 lg:items-center">
          <Wordmark className="text-lg" />
          <span className="leading-[22px]">Feito para colecionadores, criadores e cultura</span>
          <a href="mailto:contato@email.com" className="w-fit transition-colors hover:text-highlight">
            contato@email.com
          </a>
          <a href="tel:+551140028922" className="w-fit transition-colors hover:text-highlight">
            +55 11 4002 8922
          </a>
        </div>
        <div className="grid gap-8 px-6 py-10 sm:grid-cols-2 md:px-8 lg:grid-cols-4">
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className="mb-3 text-lg font-bold">{col.title}</h2>
              <ul className="flex flex-col gap-2 text-sm">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link to={l.link.to} search={l.link.search} className="inline-block transition-[color,transform] duration-200 hover:translate-x-0.5 hover:text-highlight">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-bold">Redes sociais</h2>
            <ul className="flex flex-wrap gap-2.5">
              {SOCIAL.map((s) => (
                <li key={s.name}>
                  <Link
                    to="/em-breve"
                    search={{ secao: s.label }}
                    aria-label={s.label}
                    className="grid size-10 place-items-center rounded-[8px] border border-brand/70 bg-surface-raised text-brand transition-[background-color,color,border-color,transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-brand hover:bg-brand hover:text-ink hover:shadow-[0_6px_14px_-6px_rgb(210_138_76/0.6)] focus-visible:-translate-y-0.5 active:translate-y-0 active:scale-95"
                  >
                    <Icon name={s.name} className="size-9" />
                  </Link>
                </li>
              ))}
            </ul>
            <h2 className="mt-5 text-lg font-bold">Carteiras compatíveis</h2>
            <p className="w-fit rounded-[4px] border border-line-soft bg-surface-raised px-2 py-1 text-[9px] font-bold tracking-wide text-highlight">METAMASK · WALLETCONNECT · COINBASE</p>
          </div>
        </div>
      </div>
      <p className="py-4 text-center text-sm">© 2026 Kurio. Propriedade digital para todos.</p>
    </footer>
  )
}
