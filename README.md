# Kurio — Marketplace de NFTs

Solução do [desafio de frontend da Jungle Gaming](https://github.com/junglegaming/frontend-challenge)
(enunciado copiado em [`docs/challenge/README.md`](docs/challenge/README.md)), implementada a partir do
[Figma](https://www.figma.com/design/Ff0SksUi7UFtPWUO8kyNtw/Frontend-Challenge?node-id=0-1).

- **Aplicação publicada:** https://kurio-nft-marketplace-teal.vercel.app
- **Decisões, contratos e limitações:** [`ARCHITECTURE.md`](ARCHITECTURE.md)
- **Design (SDD):** [`docs/superpowers/specs/2026-10-27-kurio-marketplace-design.md`](docs/superpowers/specs/2026-10-27-kurio-marketplace-design.md)
- **Referência do Figma (tokens, frames, assets, comentários):** [`docs/figma/README.md`](docs/figma/README.md)
- **Lighthouse:** [`lighthouse/SUMMARY.md`](lighthouse/SUMMARY.md)

## Stack

React 19 · TypeScript · Vite 8 · TanStack Router · TanStack Query · Axios · zod · Tailwind CSS v4 · shadcn/ui (Radix) ·
MSW 2 (REST + WebSocket) · Socket.IO (`socket.io-client` + `@mswjs/socket.io-binding`) · Playwright · Lighthouse CI.

Nenhum backend real: a API REST e o servidor Socket.IO são simulados na camada de rede pelo MSW, com estado consistente
entre catálogo, favoritos, carrinho, perfil, carteiras e pedidos.

## Setup

Requer Node ≥ 20.19 (testado com Node 24) e npm.

```bash
npm ci
npm run dev            # http://localhost:5173 (mocks ligados)
```

### Variáveis de ambiente

Todas opcionais (veja [`.env.example`](.env.example)):

| Variável | Padrão | Uso |
| --- | --- | --- |
| `VITE_ENABLE_MOCKS` | `true` | `false` desliga o MSW (REST/socket passam a ir para a rede) |
| `VITE_API_URL` | `/api` | base da API REST |
| `VITE_SOCKET_URL` | `wss://realtime.kurio.mock` | URL do servidor Socket.IO (interceptada pelo MSW) |

### Credenciais fictícias

| Usuário | E-mail | Senha | Particularidade |
| --- | --- | --- | --- |
| Ana Souza | `ana@kurio.test` | `Kurio@123` | tem carteiras principal (MetaMask/Ethereum) e secundária (Coinbase/Polygon) e um favorito |
| Bruno Lima | `bruno@kurio.test` | `Kurio@123` | sem carteiras (exercita o cadastro antes de pagar) |

Cupons: `KURIO10` (10%), `GENESIS25` (25%), `EXPIRED5` (expirado). Qualquer outro código é inválido.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | desenvolvimento com mocks |
| `npm run build` | verificação de tipos + build de produção (mocks incluídos: é o build de demonstração) |
| `npm run preview` | serve o build em http://localhost:4173 |
| `npm run typecheck` | `tsc -b --noEmit` |
| `npm run lint` | ESLint |
| `npm run test:e2e` | Playwright (builda, sobe o preview e roda desktop 1440 + mobile 390 em Chromium) |
| `npm run test:e2e:update` | regrava as baselines visuais |
| `npm run test:e2e:report` | abre o relatório HTML (traces e vídeos das falhas ficam em `test-results/`) |
| `npm run audit:lighthouse` | build + Lighthouse CI 3× por página e perfil (mobile/desktop) + resumo das medianas |

Um teste só: `npx playwright test e2e/cart.spec.ts --project=desktop -g "cupom"`.

## Cenários do mock e reset

Escolha o cenário de qualquer forma abaixo (ele fica salvo até o reset):

1. **Painel "Mock"** — botão de frasco no canto inferior esquerdo: lista de cenários + "Resetar dados e sessão".
2. **URL** — `?scenario=<nome>` em qualquer rota, ex.: `/?scenario=slow`.
3. **Console / testes** — `window.__kurioMock.setScenario('payment-declined')`, `await window.__kurioMock.reset()`.

| Cenário | Efeito |
| --- | --- |
| `default` | latência de 250 ms, pagamento confirmado ~2,5 s após o pedido |
| `empty` | catálogo vazio |
| `slow` | 1,5–3 s por requisição (skeletons) |
| `jitter` | latência variável com semente fixa → respostas fora de ordem |
| `offline` | toda a API falha como erro de rede |
| `error-500` | catálogo e detalhe respondem 500 |
| `flaky-503` | a primeira tentativa de cada GET responde 503 (o retry automático recupera) |
| `favorites-fail` | favoritar/desfavoritar responde 500 (rollback do otimismo) |
| `session-expired` | sessões expiram em 20 s |
| `price-change` | 4 s após abrir uma cotação, o preço do 1º item do carrinho sobe 0.05 ETH (via `nft.updated`) |
| `sold-out` | 4 s após abrir uma cotação, a edição do 1º item esgota |
| `order-timeout` | o pedido é criado, mas a resposta demora 12 s (o cliente desiste em 10 s e recupera pela idempotência) |
| `payment-declined` | o pedido termina recusado |
| `wallet-rejected` | a carteira recusa a conexão |

**Reset**: painel → "Resetar dados e sessão", `POST /api/__mock/reset` ou `window.__kurioMock.reset()` — restaura o seed
completo (catálogo, usuários, carrinhos, pedidos) e o cenário `default`.

Ações pontuais no servidor simulado (os efeitos chegam pela rede, como num backend real):

```js
__kurioMock.changePrice('emerald-ape-042')          // +0.05 ETH na edição 1/50 → nft.updated
__kurioMock.setAvailability('emerald-ape-042', 3, 0) // esgota a edição 1/50
__kurioMock.expireSessions()                          // próxima chamada autenticada → 401
__kurioMock.replayLastEvent()                         // reenvia o último evento (duplicata)
__kurioMock.replayStaleEvent('emerald-ape-042')       // reenvia uma versão antiga
__kurioMock.outage(5000)                              // derruba o socket por 5 s
```

## Como reproduzir os fluxos de falha

| Fluxo | Passos |
| --- | --- |
| Preço muda no checkout | entre como Ana, adicione um NFT, abra `/checkout`, conecte a carteira e clique em "Revisar"; no console rode `__kurioMock.changePrice('<id>')` → toast, aviso na revisão e botão "Confirmar novos valores" |
| Cotação desatualizada recusada pelo servidor | mesmo fluxo, mas rode `__kurioMock.outage(5000)` antes de `changePrice` e confirme → `QUOTE_STALE` |
| Edição esgota | carrinho com itens + `?scenario=sold-out` → aviso e "Conectar e finalizar" bloqueado |
| Pagamento recusado | `?scenario=payment-declined` e finalize → recibo "Pagamento recusado", itens continuam no carrinho |
| Clique repetido | na revisão, clique várias vezes em "Confirmar compra" → um único pedido |
| Timeout com recuperação | `?scenario=order-timeout` e finalize → após ~11 s o mesmo pedido aparece (ou recarregue a página do checkout: a tentativa é reenviada com a mesma chave) |
| Queda com pedido pendente | finalize e, durante "Aguardando confirmação", rode `__kurioMock.outage(4000)` ou recarregue → o estado é recuperado sem nova compra |
| Sessão expira | logado, rode `__kurioMock.expireSessions()` e navegue numa área privada → login com retorno ao ponto de partida |
| Lentidão / falhas | `?scenario=slow`, `?scenario=error-500` (botão "Tentar novamente"), `?scenario=offline` |
| Conflito de cadastro | cadastre-se com `ana@kurio.test` → erro no campo |
| Cupom | `NAOEXISTE` (inválido), `EXPIRED5` (expirado), `KURIO10` (válido) |

## Testes

Playwright cobre os 12 cenários pedidos (`e2e/*.spec.ts`), sempre pela interface e pela rede: REST pelos handlers MSW,
tempo real pelo `socket.io-client`. Cada teste roda num contexto novo (seed limpo). Relógio controlado com `page.clock`
nos testes de carregamento; disparo de eventos via `window.__kurioMock` (que age no servidor simulado).

- Projetos: `desktop` (1440×900, suíte completa) e `mobile` (390×844, fluxos principais + visuais).
- Regressão visual de início, detalhe, carrinho e pagamento com baselines versionadas em `e2e/__screenshots__/`.
- Relatório HTML em `playwright-report/`, traces/vídeos das falhas em `test-results/`.

## Performance

Auditoria com Lighthouse CI sobre o build otimizado servido por `vite preview`, cenário padrão dos mocks, 3 execuções
por página (início e detalhe) e perfil (mobile e desktop). Configuração versionada em
[`lighthouse/lighthouserc.cjs`](lighthouse/lighthouserc.cjs); relatórios HTML/JSON em `lighthouse/reports/`; medianas,
LCP, CLS, TBT, versões e ambiente em [`lighthouse/SUMMARY.md`](lighthouse/SUMMARY.md); causas e justificativa do
resultado mobile em [`lighthouse/ANALYSIS.md`](lighthouse/ANALYSIS.md).

| Categoria (mediana) | Mobile início / detalhe | Desktop início / detalhe |
| --- | ---: | ---: |
| Performance | 86 / 88 | 99 / 99 |
| Accessibility | 100 / 100 | 100 / 100 |
| Best Practices | 100 / 100 | 100 / 100 |
| SEO | 100 / 100 | 100 / 100 |

## Deploy

Build estático (`npm run build` → `dist/`) com rewrite de SPA (`vercel.json`), mocks e tempo real ativos no ambiente
publicado; acesso direto e refresh em qualquer rota funcionam.

## Estrutura

```
src/
  api/        contratos zod, cliente Axios, endpoints
  app/        router, sessão, QueryClient, layout
  features/   catalog, nft, cart, checkout, auth, account, misc
  realtime/   socket.io-client + gate de eventos
  mocks/      db + seed, handlers REST, servidor Socket.IO, cenários
  components/ UI compartilhada e shadcn/ui
e2e/          Playwright
lighthouse/   configuração, relatórios e resumo
docs/         enunciado, Figma, SDD
```
