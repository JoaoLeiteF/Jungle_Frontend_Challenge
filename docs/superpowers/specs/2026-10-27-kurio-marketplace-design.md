# Kurio — Marketplace de NFTs · Design (SDD)

Data: 2026-10-27 · Autor: Claude (sessão autônoma; João revisa ao final) · Fonte: `README.md.txt` (enunciado Jungle Gaming)
e Figma `Ff0SksUi7UFtPWUO8kyNtw` (ver `docs/figma/README.md`).

## 1. Intenção

Entregar o desafio de frontend da Jungle Gaming: um marketplace de NFTs ("Kurio") fiel ao Figma, onde **toda** regra de
negócio vive atrás de uma API REST + Socket.IO simulada na camada de rede (MSW). A avaliação pesa fluxos reais
(compra, conta), estado assíncrono correto e tempo real — não só a tela. O avaliador (CEO, ex-arquiteto full-stack)
valoriza "contexto antes de código, evidência antes de suposição": decisões explícitas, trade-offs documentados,
execução reproduzível.

## 2. Objetivos, não-objetivos, anti-objetivos

**Objetivos** (pontuação do enunciado §11, em ordem de peso)
1. Fidelidade visual 1440/768/390 (20) · 2. Fluxos completos de compra e conta (20) · 3. Router/Query/Axios/contratos (15)
4. Tempo real (10) · 5. Mocking determinístico (10) · 6. Playwright (10) · 7. A11y (5) · 8. Lighthouse (5) · 9. Docs (5)

**Não-objetivos**: blockchain real, extensões de carteira, gateways; páginas editoriais (Criadores, Aprenda, blog
completo), suporte, atividade, ofertas, downloads. Links para elas existem mas levam a uma página "Em breve" honesta
(nunca simulam sucesso).

**Anti-objetivos (eliminatórios — §11)**: stack obrigatória decorativa; fluxo só visual; compra confirmada sem resposta
da simulação; dados vazando entre usuários; eventos disparados direto na UI (setter/cache em vez de `socket.io-client`);
sem E2E executável. Também: respostas fictícias dentro de componentes/hooks/cliente Axios.

## 3. Restrições

- Stack obrigatória: React, TypeScript, TanStack Router, TanStack Query, Axios, REST, Socket.IO, Tailwind, shadcn/ui, MSW,
  Playwright, Lighthouse. Build/organização livres.
- Valores ETH trafegam como **strings decimais**; cálculo com precisão (BigInt em wei, 18 casas). Quantidades inteiras.
  A cotação da API é a referência para finalizar.
- Deploy público obrigatório (Vercel), com mocks e tempo real funcionando no build publicado; refresh/acesso direto em
  qualquer rota.
- Checkout limpo → `npm ci && npm run dev` funciona sem serviços externos.

## 4. Decisões de "como" (minhas, registradas)

| Tema | Decisão | Porquê |
| --- | --- | --- |
| Build | Vite 8 + React 19 + TS 5.9 strict | padrão do ecossistema; deploy trivial na Vercel |
| Rotas | TanStack Router **code-based**, `validateSearch` com zod | menos mágica que file-based; search params tipados |
| Estado remoto | TanStack Query v5, query keys por usuário (`['u', userId, ...]`) | isolamento por usuário é requisito |
| HTTP | 1 instância Axios; `signal` do Query para cancelamento; interceptor de 401 → evento de sessão expirada | §4 |
| Estilo | Tailwind v4 (`@theme` com os tokens do Figma) + shadcn/ui reestilizado | §8 |
| Formulários | react-hook-form + zod (padrão do `Form` do shadcn); schemas compartilhados com os mocks | erros de campo associados |
| ETH | helpers BigInt próprios (`parseEth`, `formatEth`, `mulQty`) | stdlib, sem dependência; precisão exata |
| Mocks | MSW 2 (`setupWorker`), "banco" em memória persistido em `localStorage`, cenários configuráveis | §6 |
| Tempo real | `socket.io-client` (transport `websocket`) interceptado por `ws.link` do MSW + `@mswjs/socket.io-binding` | §6/§7 |
| Testes | Playwright (Chromium, projetos desktop 1440 e mobile 390), screenshots versionadas | §9 |
| Auditoria | `@lhci/cli` com `lighthouserc.cjs` versionado, 3 execuções, perfis mobile/desktop | §10 |
| Ícones | SVGs exportados do Figma + `lucide-react` para glifos ausentes | documentado |

## 5. Arquitetura

```
src/
  app/          router, providers (QueryClient, Session, Socket), layout (Header, Footer, MobileNav)
  api/          axios client, contratos (tipos + zod) por recurso, funções de transporte
  features/     catalog, nft, cart, checkout, orders, auth, profile, wallets, favorites
                (cada uma: queries.ts com queryOptions/mutations + componentes)
  realtime/     socket client, reconciliação (versão/dedupe), ligação com o cache
  lib/          eth.ts (BigInt), format, utils
  components/ui shadcn reestilizado; components/ compartilhados (NftCard, Price, Skeleton…)
  mocks/        db (fixtures + persistência), handlers REST, socket handler, scenarios, browser.ts
```

Camadas: **transporte** (`api/`: Axios + zod parse das respostas) → **estado** (`features/*/queries.ts`: Query) →
**interface**. Componentes nunca importam `mocks/`. O único acoplamento com o mock é `main.tsx` decidir ligar o worker
(`VITE_ENABLE_MOCKS`, ligado em dev e no build de demonstração).

## 6. Contratos REST (prefixo `/api`)

Envelope de erro único: `{ error: { code, message, fields?: Record<string,string>, details? } }` com status HTTP
semântico: 400 `VALIDATION`, 401 `UNAUTHENTICATED`/`SESSION_EXPIRED`, 403 `FORBIDDEN`, 404 `NOT_FOUND`,
409 `CONFLICT` (`EMAIL_TAKEN`, `OUT_OF_STOCK`, `QUOTE_STALE`, `IDEMPOTENCY_MISMATCH`), 422 `COUPON_INVALID`/`COUPON_EXPIRED`,
503 `UNAVAILABLE` (transitória, `Retry-After`).

| Recurso | Endpoints |
| --- | --- |
| Sessão | `POST /auth/register`, `POST /auth/login`, `GET /auth/session`, `POST /auth/logout` (token opaco `Bearer`, TTL de sessão no mock) |
| NFTs | `GET /nfts?q&collection[]&network[]&minPrice&maxPrice&tab&sort&page&pageSize` → `{items,total,page,pageSize,facets}`; `GET /nfts/:id` |
| Favoritos | `GET /favorites`, `PUT /favorites/:nftId`, `DELETE /favorites/:nftId` |
| Carrinho | `GET /cart`, `POST /cart/items`, `PATCH /cart/items/:itemId`, `DELETE /cart/items/:itemId`, `POST /cart/merge` (carrinho visitante → usuário). Visitante identificado por header `X-Cart-Id` |
| Cotação | `POST /quote { couponCode? }` → `{ quoteId, version, items[{ itemId, nftId, edition, qty, unitPriceEth, available }], subtotalEth, discountEth, networkFeeEth, totalEth, coupon, issues[] , expiresAt }` |
| Pedidos | `POST /orders` (header `Idempotency-Key`, body `{ quoteId, walletId, network, buyer }`), `GET /orders/:id` (estado + recibo snapshot), `GET /orders?status=pending` (retomada) |
| Perfil | `GET /me`, `PATCH /me` (dados + `avatarDataUrl`), `POST /me/password` |
| Carteiras | `GET /wallets`, `POST /wallets`, `PATCH /wallets/:id` (papéis `primary`/`secondary`) |
| Mock | `POST /__mock/reset`, `GET/PUT /__mock/scenario` (controle de cenários; só existe com mocks ligados) |

NFT: `{ id, slug, name, collection, network, image, description, attributes, rating, editions: [{ edition, priceEth, available, maxPerOrder }], version, updatedAt }`.
Preço/disponibilidade são **por edição**; a UI de detalhe seleciona edição e quantidade (limite = `min(available, maxPerOrder)`).

**Idempotência**: mesma chave + mesmo corpo → mesmo pedido (200 com o pedido existente); mesma chave + corpo diferente →
409 `IDEMPOTENCY_MISMATCH`. A chave é gerada ao **abrir a revisão** e mantida em `sessionStorage` até estado terminal, então
clique repetido, timeout e refresh reaproveitam a mesma tentativa.

**Revalidação**: `POST /orders` recalcula a cotação; se `quote.version` divergir (preço, disponibilidade, cupom, taxa) →
409 `QUOTE_STALE` com a nova cotação; a UI mostra as diferenças e exige nova confirmação.

## 7. Tempo real

Socket em `wss://realtime.kurio.mock` (path padrão do Socket.IO), `auth: { token }`. Servidor simulado usa os mesmos
dados do `db` dos handlers REST — toda mutação no db emite o evento correspondente.

Evento: `{ eventId, type: 'nft.updated'|'order.updated', resource: { type, id }, version, occurredAt, userId?, data }`.

Cliente (`realtime/`):
- `seen` de `eventId` (dedupe) e `lastVersion[resourceKey]`; ignora `version <= last` (sem regressão, sem reaplicar efeito).
- `nft.updated` → `setQueryData` nos detalhes/listas que contêm o NFT + invalida cotação/carrinho; anúncio `aria-live`
  e toast "Preço de X mudou".
- `order.updated` → atualiza `['u',userId,'order',id]`; ignora evento cujo `userId` ≠ sessão atual.
- `connect` após queda → `invalidateQueries` dos recursos ativos (reconciliação REST).
- Logout/troca de usuário → `socket.disconnect()`, `queryClient.clear()` das chaves privadas, listeners removidos no cleanup.

Cenário obrigatório: NFT no carrinho muda preço → banner no carrinho/checkout + resumo atualizado → `POST /orders` com
cotação antiga recebe `QUOTE_STALE` → usuário confirma de novo. Pedido pendente + queda de conexão → ao reconectar/
recarregar, `GET /orders/:id` (id salvo junto da chave de idempotência) restaura o estado sem nova compra.

## 8. Mocks e cenários

- `db` (fixtures determinísticas): ~48 NFTs (4 artes × variações de nome/coleção/rede/preço, 9 coleções e 3 redes do
  Figma), 2 usuários (`ana@kurio.test` / `bruno@kurio.test`, senha `Kurio@123`, hash SHA-256 com salt), cupons
  (`KURIO10` válido, `EXPIRED5` expirado), carteiras seed. Persistido em `localStorage` (`kurio.mockdb.v1`); reset restaura
  o seed.
- Cenários (painel "Mock" flutuante no app + `?scenario=` + `PUT /__mock/scenario`, persistidos):
  `default`, `empty`, `slow` (latência 1.5–3 s), `jitter` (latência variável seed → respostas fora de ordem),
  `offline` (network error), `error-500`, `flaky-503`, `session-expired`, `forbidden`, `register-conflict`,
  `price-change` (muda preço do 1º item do carrinho após N s via socket), `sold-out` (esgota edição durante checkout),
  `order-timeout` (cria o pedido e devolve timeout; recuperação por idempotência), `payment-confirmed`, `payment-declined`.
- Latência controlada por relógio injetável para os testes (`window.__kurioMock` expõe `setScenario`, `emit`, `reset`).
- Limitações documentadas: binding não suporta rooms/namespaces → servidor simulado filtra por `userId` da conexão; o
  Socket.IO roda só sobre `websocket` (sem long-polling).

## 9. Telas

Início (hero carrossel, sidebar de filtros: coleções, faixa de preço [slider + min/max], rede; tabs Todos/Novos/Em alta;
ordenação; grid 3 col; paginação; destaque; promoções; blog estático), Detalhe (galeria, info, edição, quantidade,
favorito, comprar, avaliações tab, "Mais desta coleção"), Carrinho, Pagamento (dados, carteira+rede, revisão), Confirmação
(pendente/confirmado/recusado), Login/Cadastro (modal no desktop sobre a página atual, tela no mobile), Perfil, Carteiras.
404 e "Em breve". Mobile: barra inferior (Início, Favoritos, Carrinho, Perfil) como no Figma.

Estado da URL no catálogo: `/?q=&collections=a,b&networks=&min=&max=&tab=&sort=&page=` — mudar filtro zera `page`.

Rotas: `/`, `/nft/$nftId`, `/cart`, `/checkout` (privada), `/orders/$orderId` (privada), `/login`, `/register`,
`/profile` (privada), `/profile/wallets` (privada), `/coming-soon`, `*`.

## 10. Sessão

Token em `localStorage` (`kurio.session`), validado por `GET /auth/session` no boot (`beforeLoad` das rotas privadas
aguarda). 401 em qualquer chamada → `session.expire()` → limpa cache privado, guarda `redirect` (e rascunho do checkout
em `sessionStorage`), abre login; após login volta ao fluxo. Carrinho de visitante (`X-Cart-Id`) é mesclado no login.

## 11. Cache, retries, otimismo

- `staleTime` 30 s catálogo/detalhe, 0 para cotação; `gcTime` 5 min; `placeholderData: keepPreviousData` na listagem.
- Retry: 2× com backoff só para erros de rede/503; nunca para 4xx; mutations não repetem automaticamente
  (pedido usa idempotência explícita).
- Otimista: **favoritos** (toggle com rollback e toast em falha) e quantidade no carrinho.
- Invalidação: mutations do carrinho → `cart` + `quote`; pedido confirmado → `cart`, `orders`; eventos → ver §7.

## 12. Qualidade

- A11y: foco visível, foco preso em Dialog/Sheet (Radix), labels + `aria-describedby` de erro, `aria-live` para
  mutations e tempo real, contraste ≥ 4.5 (ajustes registrados), sem overflow a 320 px/zoom 200%.
- Skeletons com shimmer e mesmas dimensões; `prefers-reduced-motion` desliga shimmer/transições.
- Performance: imagens WebP com `srcset` (320/480/640/1254), `loading=lazy` fora da dobra, fonte Roboto Mono self-hosted
  (`@fontsource-variable/roboto-mono`), code-splitting por rota, MSW carregado antes do render.

## 13. Fora do meu controle / deixado ao implementador

- Medidas finas de espaçamento vêm dos recortes em `docs/figma/*.png`; inconsistências do Figma (comentários) são
  normalizadas para o padrão dominante e listadas em `ARCHITECTURE.md`.
- Tablet (768) não tem frame: layout intermediário (grid 2 col, sidebar vira Sheet de filtros).
