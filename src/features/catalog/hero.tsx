import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { NftImage } from '@/components/nft-image'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const SLIDES = [
  {
    image: 'emerald-ape',
    eyebrow: 'Bem-vindo à Kurio',
    title: 'Seja dono do futuro da arte digital',
    text: 'Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da cultura da internet.',
    search: {},
  },
  {
    image: 'sage-nomad',
    eyebrow: 'Coleções verificadas',
    title: 'Arte com procedência registrada na rede',
    text: 'Cada obra tem histórico imutável, metadados no IPFS e royalties automáticos para quem cria.',
    search: { collections: 'colecionaveis' },
  },
  {
    image: 'golden-beat',
    eyebrow: 'Em alta esta semana',
    title: 'Os drops que os colecionadores mais disputam',
    text: 'Edições limitadas com alta procura — entre antes que a próxima esgote.',
    search: { tab: 'trending' as const },
  },
]

const AUTOPLAY_MS = 6000

export function Hero() {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [warm, setWarm] = useState(false)
  const touchX = useRef<number | null>(null)
  const go = (i: number) => setIndex((i + SLIDES.length) % SLIDES.length)
  const depth = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'mouse' || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const r = e.currentTarget.getBoundingClientRect()
    e.currentTarget.style.setProperty('--px', (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3))
    e.currentTarget.style.setProperty('--py', (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3))
  }

  useEffect(() => {
    const t = setTimeout(() => setWarm(true), 1500)
    return () => clearTimeout(t)
  }, [])
  useEffect(() => {
    if (paused || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setTimeout(() => setIndex((i) => (i + 1) % SLIDES.length), AUTOPLAY_MS)
    return () => clearTimeout(t)
  }, [index, paused])

  return (
    <section
      aria-roledescription="carrossel"
      aria-label="Destaques"
      className="relative isolate mt-4 overflow-hidden rounded-[20px] bg-[radial-gradient(130%_110%_at_88%_8%,#5a3520_0%,#38220f_40%,#241612_78%)] before:absolute before:-top-24 before:-right-20 before:-z-10 before:size-72 before:rounded-full before:bg-brand/10 md:mt-0 md:rounded-none md:bg-none md:before:hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={(e) => {
        setPaused(false)
        e.currentTarget.style.setProperty('--px', '0')
        e.currentTarget.style.setProperty('--py', '0')
      }}
      onPointerMove={depth}
      onFocus={() => setPaused(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(index + 1)
        if (e.key === 'ArrowLeft') go(index - 1)
      }}
      onTouchStart={(e) => (touchX.current = e.touches[0]!.clientX)}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0]!.clientX - (touchX.current ?? e.changedTouches[0]!.clientX)
        if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1))
      }}
    >
      <div className="flex transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]" style={{ transform: `translateX(-${index * 100}%)` }} aria-live={paused ? 'polite' : 'off'}>
        {SLIDES.map((slide, i) => {
          const active = i === index
          const Title = active ? 'h1' : 'p'
          const rise = (delay: number) => ({
            className: cn('transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]', active ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'),
            style: { transitionDelay: active ? `${delay}ms` : '0ms' },
          })
          return (
            <div
              key={slide.image}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} de ${SLIDES.length}`}
              inert={!active}
              className={cn(
                'grid w-full shrink-0 grid-cols-[1fr_40%] items-center gap-3 p-4 transition-opacity duration-700 md:grid-cols-[1fr_minmax(0,450px)] md:items-start md:gap-10 md:p-0 md:py-6',
                active ? 'opacity-100' : 'opacity-0',
              )}
            >
              <div className="md:pt-[54px] md:pl-8">
                <p {...rise(0)}>
                  <span className="inline-flex items-center gap-2 text-xs font-medium tracking-[0.1em] md:text-sm">
                    <span aria-hidden className="h-px w-6 bg-brand max-md:hidden" />
                    {slide.eyebrow}
                  </span>
                </p>
                <Title {...rise(90)} className={cn(rise(90).className, 'mt-2 text-base leading-tight font-bold tracking-[0.04em] uppercase md:mt-5 md:max-w-[600px] md:text-[43px] md:leading-[70px]')}>
                  {slide.title}
                </Title>
                <p {...rise(180)} className={cn(rise(180).className, 'mt-2 max-w-[520px] text-xs leading-4 text-sand md:mt-3 md:text-sm md:leading-[26px]')}>
                  {slide.text}
                </p>
                <div {...rise(270)}>
                  <Button asChild className="cta group/cta mt-3 h-[31px] px-4 text-sm max-md:h-auto max-md:bg-transparent max-md:px-0 max-md:text-highlight max-md:hover:bg-transparent md:mt-8 md:h-10 md:px-6 md:text-base">
                    <Link to="/" search={slide.search} hash="catalogo">
                      EXPLORAR <ArrowRight aria-hidden className={cn('transition-transform duration-200 group-hover/cta:translate-x-1', active && 'cta-nudge')} />
                    </Link>
                  </Button>
                </div>
              </div>
              <div className="relative w-full max-w-[450px]">
                <span aria-hidden className={cn('pointer-events-none absolute -inset-12 -z-10 hidden rounded-full bg-[radial-gradient(closest-side,rgb(232_155_85/0.22),transparent_75%)] blur-3xl transition-opacity duration-1000 md:block', active ? 'opacity-100' : 'opacity-0')} />
                <div className="aspect-square overflow-hidden rounded-[14px] shadow-[0_10px_24px_-10px_rgb(0_0_0/0.7)] transition-transform duration-700 ease-out md:rounded-hero md:shadow-[0_24px_48px_-24px_rgb(0_0_0/0.8)] md:[transform:translate3d(calc(var(--px,0)*-6px),calc(var(--py,0)*-6px),0)]">
                  {(i === 0 || warm) && (
                    <NftImage
                      image={slide.image}
                      alt={`Arte em destaque: ${slide.title}`}
                      priority={i === 0}
                      sizes="(min-width: 768px) 450px, 40vw"
                      className={cn('transition-transform duration-[1200ms] ease-out', active ? 'scale-100' : 'scale-105')}
                    />
                  )}
                </div>
                {warm && (
                  <button
                    type="button"
                    onClick={() => go(i + 1)}
                    aria-label={`Próximo destaque: ${SLIDES[(i + 1) % SLIDES.length]!.title}`}
                    className={cn(
                      'absolute -bottom-3 -left-4 w-[46%] overflow-hidden rounded-[10px] ring-2 ring-surface-card shadow-[0_6px_14px_-6px_rgb(0_0_0/0.8)] transition-[transform,opacity] delay-300 duration-700 ease-out active:scale-95 md:hidden',
                      active ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
                    )}
                  >
                    <NftImage image={SLIDES[(i + 1) % SLIDES.length]!.image} alt="" sizes="80px" />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex justify-center pb-2 md:absolute md:bottom-9 md:left-[52%] md:pb-0">
        {SLIDES.map((s, i) => (
          <button key={s.image} type="button" onClick={() => setIndex(i)} aria-label={`Destaque ${i + 1} de ${SLIDES.length}`} aria-current={i === index} className="group/dot grid h-6 min-w-6 place-items-center px-1">
            <span aria-hidden className={cn('relative h-2.5 overflow-hidden rounded-full border border-brand transition-all duration-500 ease-out', i === index ? 'w-6 bg-brand/40' : 'w-2.5 bg-brand/40 group-hover/dot:bg-brand/70')}>
              {i === index && <span key={index} className="dot-progress absolute inset-0 origin-left bg-brand" style={{ animationPlayState: paused ? 'paused' : 'running', animationDuration: `${AUTOPLAY_MS}ms` }} />}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
