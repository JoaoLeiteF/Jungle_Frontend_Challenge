# Lighthouse — análise

Medianas, versões e ambiente: [`SUMMARY.md`](SUMMARY.md) (gerado). Relatórios brutos (3 execuções por página e perfil,
HTML + JSON): [`reports/mobile`](reports/mobile) e [`reports/desktop`](reports/desktop). Configuração versionada:
[`lighthouserc.cjs`](lighthouserc.cjs).

## Condições

- Build de produção (`npm run build`) servido por `vite preview` em `localhost:4173`, cenário padrão dos mocks, sem
  cache (cada execução é uma visita nova: service worker do MSW registrado do zero, seed recriado).
- Mobile: perfil padrão do Lighthouse (Moto G Power emulado, 4G lento simulado — RTT 150 ms, 1,6 Mbps —, CPU 4×).
  Desktop: preset `desktop`. Chrome headless; máquina Windows 10 (benchmarkIndex ≈ 2300).
- Nenhuma simplificação exclusiva para a auditoria: imagens, fonte, mocks REST e Socket.IO rodam como no deploy.

## Resultado

| Categoria | Meta | Mobile (início / detalhe) | Desktop (início / detalhe) |
| --- | ---: | ---: | ---: |
| Performance | ≥ 90 | **86 / 88** | 99 / 99 |
| Accessibility | ≥ 95 | 100 / 100 | 100 / 100 |
| Best Practices | ≥ 95 | 100 / 100 | 100 / 100 |
| SEO | ≥ 90 | 100 / 100 | 100 / 100 |

CLS ≈ 0 e TBT ≤ 150 ms em todos os perfis. O único item abaixo da meta é **Performance mobile** (86/88), por LCP
≈ 3,5–3,6 s.

## Por que o mobile fica abaixo de 90

Decomposição do LCP no mobile (mediana, início): TTFB ≈ 0,5 s · atraso de carga ≈ 1,3 s · carga ≈ 0,55 s · atraso de
renderização ≈ 1,1 s.

1. **O backend simulado roda no navegador antes do primeiro render.** O chunk do MSW + servidor simulado custa
   ≈ 0,6 s de CPU com throttling 4× (registro do service worker, interceptores, seed do db), e a aplicação só pode
   renderizar depois dele — sem isso, a primeira requisição escaparia do mock. Num produto real esse custo não existe;
   aqui ele é parte da entrega (o enunciado exige os mocks no build auditado).
2. **O LCP depende de dados.** No mobile o maior elemento é a imagem do primeiro card (catálogo) ou a obra no detalhe,
   que só existe depois da resposta da API simulada (latência padrão de 250 ms).
3. **TTFB do `vite preview`** (≈ 0,5 s simulado) — servidor de desenvolvimento local; no CDN da Vercel é menor.

## O que foi feito (com efeito medido)

| Mudança | Efeito |
| --- | --- |
| `tough-cookie`/`tldts` do MSW trocados por um stub (a API simulada é por token, nunca usa cookies) | chunk do mock 172 KB → 52 KB gzip; LCP mobile −0,3 s |
| Margem do skeleton colapsava através de `<main>` até o `<body>` quando o header some no mobile (`flow-root` + skeleton com a mesma geometria) | CLS mobile do detalhe 0,165 → 0; desktop 0,111 → 0 |
| `<main>` reserva altura de viewport | rodapé não "pula" durante o carregamento |
| Chunks da aplicação baixam em paralelo ao MSW; `socket.io-client` carregado sob demanda (não captura `WebSocket` cedo) | FCP mais cedo |
| `loader` das rotas dispara o prefetch do TanStack Query em paralelo ao chunk lazy | requisição de dados sai antes do componente montar |
| WebP 320/480/640/1254 com `srcset`/`sizes`, primeira fileira `eager` + `fetchpriority=high`, preload da arte do hero | menos bytes de imagem no mobile |
| Fonte Roboto Mono auto-hospedada (subset latin), `font-display: swap`; preload removido após medir (competia com o JS) | |
| Rótulo acessível do destaque contém o texto visível; bolinhas do carrossel com alvo de 24 px | Accessibility 97 → 100 |

## Próximos passos (se o mock pudesse sair do caminho crítico)

- Renderizar o shell (header, hero) antes do MSW e adiar só as requisições — exige enfileirar chamadas até o worker
  ativar; ganho estimado ~0,5 s no LCP.
- `zod/mini` no lugar de `zod` (≈ 20 KB gzip a menos) — troca de API em todos os contratos.
