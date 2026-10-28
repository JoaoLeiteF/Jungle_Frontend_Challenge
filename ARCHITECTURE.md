# Arquitetura — Kurio

Documento de decisões. O "porquê" de cada escolha, os contratos e as limitações conhecidas. Design original (SDD):
`docs/superpowers/specs/2026-10-27-kurio-marketplace-design.md`. Referência do Figma: `docs/figma/README.md`.

## 1. Visão geral

```
            ┌────────────── navegador ──────────────────────────────────────────────┐
  UI (React) ── features/*/queries.ts (TanStack Query) ── api/endpoints.ts (Axios + zod)
      │                     ▲                                   │  /api/*
      │                     │ setQueryData / invalidate         ▼
      │              realtime/bridge.tsx ◄── socket.io-client ── WebSocket (wss://realtime.kurio.mock)
      │                                                         │
      │                               ┌── MSW (service worker + interceptor de WebSocket) ──┐
      │                               │  mocks/handlers.ts (REST)   mocks/realtime.ts (S.IO) │
      │                               │            └──────── mocks/db.ts ────────┘           │
      │                               │     estado único + seed determinístico + localStorage │
      └───────────────────────────────┴───────────────────────────────────────────────────────┘
```

- **Camadas**: transporte (`src/api`) → estado (`src/features/*/queries.ts`, `src/app/session.ts`, `src/realtime`) →
  interface (componentes). Componentes, hooks e o cliente Axios **não** contêm respostas fictícias nem caminhos
  alternativos de negócio; o único ponto que conhece os mocks é `src/main.tsx`, que liga o MSW por configuração.
- **Contratos tipados de ponta a ponta**: `src/api/contracts.ts` define schemas zod usados em três lugares — o Axios
  valida toda resposta (`request(schema, …)`), os handlers MSW validam o corpo das requisições e os formulários usam os
  mesmos schemas (react-hook-form + zodResolver). Um desvio de contrato quebra alto, não silenciosamente.
- **Ordem de boot**: `main.tsx` baixa o chunk do MSW e o da aplicação em paralelo, mas só renderiza depois que o
  worker está ativo (a primeira requisição não pode escapar do mock). O `engine.io-client` captura
  `globalThis.WebSocket` quando é avaliado, por isso o `socket.io-client` é importado sob demanda dentro do
  `RealtimeBridge` — que só roda após o MSW ter feito o patch. Rotas com dados (`/`, `/nft/$id`) têm `loader` que
  dispara o prefetch do TanStack Query sem bloquear, em paralelo ao chunk lazy da página.

## 2. Contratos REST (`/api`)

Erros sempre no envelope `{ error: { code, message, fields?, details? } }`.

| Situação | HTTP | `code` |
| --- | ---: | --- |
| Validação de formulário | 400 | `VALIDATION` (+ `fields`) |
| Sem sessão / sessão expirada | 401 | `UNAUTHENTICATED` / `SESSION_EXPIRED` |
| Credenciais inválidas | 401 | `INVALID_CREDENTIALS` |
| Recurso de outro usuário | 403 | `FORBIDDEN` |
| Recurso inexistente | 404 | `NOT_FOUND` |
| Conflito de cadastro | 409 | `EMAIL_TAKEN` / `USERNAME_TAKEN` (+ `fields`) |
| Disponibilidade | 409 | `EDITION_UNAVAILABLE`, `QUANTITY_LIMIT`, `OUT_OF_STOCK` |
| Cotação mudou | 409 | `QUOTE_STALE` (+ `details.quote` com a cotação nova) |
| Idempotência com corpo diferente | 409 | `IDEMPOTENCY_MISMATCH` |
| Carteira recusou / conector errado / desconectada | 403/409 | `WALLET_REJECTED` |
| Cupom | 422 | `COUPON_INVALID` / `COUPON_EXPIRED` |
| Falha transitória | 503 / 500 | `UNAVAILABLE` (com `Retry-After`) / `INTERNAL` |

| Recurso | Endpoint | Observações |
| --- | --- | --- |
| Sessão | `POST /auth/register`, `POST /auth/login`, `GET /auth/session`, `POST /auth/logout` | token opaco `Bearer`; expiração deslizante (30 min, 20 s no cenário `session-expired`) |
| NFTs | `GET /nfts?q&collections&networks&min&max&tab&sort&page&pageSize` | listas separadas por vírgula (iguais à URL); resposta traz `facets` (contagens por coleção/rede, ignorando o próprio filtro) e `priceRange` |
| | `GET /nfts/:id` | inclui `reviews`; 404 para inexistente |
| Favoritos | `GET /favorites`, `PUT /favorites/:id`, `DELETE /favorites/:id` | privado |
| Carrinho | `GET /cart`, `POST /cart/items`, `PATCH /cart/items/:id`, `DELETE /cart/items/:id`, `PUT /cart/coupon`, `POST /cart/merge` | visitante identificado por `X-Cart-Id`; usuário por sessão |
| Cotação | `POST /quote` | subtotal, desconto, taxa e total calculados no "servidor"; `version` = impressão digital de preços+disponibilidade+cupom+taxa; `issues[]` para esgotado/quantidade reduzida |
| Pedidos | `POST /orders` (header `Idempotency-Key`), `GET /orders/:id`, `GET /orders` | criação revalida a cotação; recibo é snapshot |
| Perfil | `GET /me`, `PATCH /me` (inclui `avatarDataUrl`), `POST /me/password` | |
| Carteiras | `GET /wallets`, `POST /wallets`, `PATCH /wallets/:id`, `POST /wallets/:id/connect`, `POST /wallets/:id/disconnect` | papéis `primary`/`secondary` únicos; endereço validado por rede; ENS só em Ethereum |
| Controle do mock | `POST /__mock/reset`, `GET/PUT /__mock/scenario` | só existem com mocks ligados |

**ETH**: sempre string decimal (`"1.19"`). Cálculo em BigInt (wei, 18 casas) em `src/lib/eth.ts`; a UI só formata.
Quantidades são inteiras. Totais exibidos vêm da cotação da API, nunca de soma no componente.

**Idempotência de pedidos** (`src/features/checkout/attempt.ts`): uma *tentativa* = `{ chave, corpo }` gravada em
`sessionStorage` quando o usuário confirma. Clique repetido (a mutation tem `scope` serial), timeout/erro de rede
(reenvio automático com a mesma chave, até 3×) ou refresh (o checkout reenvia a tentativa pendente ao abrir) recuperam
o **mesmo** pedido. Corpo diferente gera chave nova; reaproveitar chave com corpo diferente é 409 no servidor.

## 3. Eventos Socket.IO

Envelope: `{ eventId, type, resource: { type, id }, version, occurredAt, userId?, data }`.

| Evento | Quando | `data` | Efeito no cliente |
| --- | --- | --- | --- |
| `nft.updated` | qualquer mudança de preço/disponibilidade no db (cenários, liquidação de pedido, `__kurioMock`) | `listPriceEth`, `editions[]`, `reason` | patch no detalhe e em todas as listagens em cache; se o NFT está no carrinho, invalida carrinho e cotação e anuncia (toast `aria-live`) |
| `order.updated` | liquidação do pedido (confirmado/recusado) | `status`, `txHash`, `explorerUrl`, `rejectionReason` | atualiza o pedido em cache (só se `userId` = sessão atual); confirmado invalida o carrinho |

**Ordenação e duplicatas** (`src/realtime/gate.ts`): cada `eventId` é aceito uma vez; para cada recurso guarda-se a
maior versão vista, e um evento só aplica se `version` > max(vista, versão do recurso já em cache). Duplicatas e
eventos antigos são descartados sem regredir estado nem repetir efeitos (toasts têm `id` estável).

**Reconciliação com REST**: ao reconectar (`connect` após a primeira conexão), `invalidateQueries({ type: 'active' })`
recarrega tudo o que está na tela. O pedido pendente também faz polling a cada 5 s enquanto `pending` — cobre o caso
de o evento de liquidação acontecer durante a queda.

**Ciclo de vida**: um socket por token de sessão (`RealtimeBridge`). Login, logout e troca de usuário destroem o socket
anterior (`removeAllListeners` + `disconnect`) e criam outro com o novo `auth.token`; o servidor simulado associa a
conexão ao usuário e só entrega `order.updated` ao dono — eventos de uma sessão anterior não alcançam outro usuário
(e, por defesa em profundidade, o cliente também ignora `userId` diferente).

**Transporte e limitações no ambiente de mocks** (`src/mocks/realtime.ts`):
- MSW intercepta o `WebSocket` aberto pelo `socket.io-client` real (`transports: ['websocket']`) e o
  `@mswjs/socket.io-binding` codifica/decodifica o protocolo Socket.IO.
- O binding não implementa rooms, namespaces nem broadcast e sintetiza o handshake; por isso o servidor simulado
  mantém seu próprio registro de conexões, lê o token do pacote CONNECT bruto (`40{...}`) e envia o heartbeat do
  engine.io (`2`) a cada 20 s (sem ele o cliente derruba a conexão em ~30 s).
- Long-polling não é suportado; só websocket.
- Um socket fechado ainda em `CONNECTING` não dispara `close` no interceptor (acontece com o StrictMode); conexões
  mortas são podadas por `readyState`.
- Não há rede real: "queda de conexão" é simulada pelo servidor (`outage(ms)` fecha os sockets e recusa reconexões).

## 4. Sessão

- Token em `localStorage` (`kurio.session`); no boot, `GET /auth/session` valida antes de qualquer rota privada
  resolver (`beforeLoad` aguarda `session.ready()`). Rotas privadas: checkout, pedido, perfil, carteiras, favoritos.
- Senhas nunca são guardadas em claro: o mock armazena `SHA-256(salt:senha)` com salt por usuário.
- **Expiração**: qualquer 401 com token presente passa pelo interceptor único do Axios → `session.expire()` → limpa o
  cache privado e mostra aviso; se o usuário estava numa tela privada, vai para `/login?redirect=<tela>` e volta para
  ela após entrar. No checkout, o rascunho do formulário fica em `sessionStorage` e é restaurado.
- **Logout / troca de usuário**: `removeQueries(['u'])` e `['guest']`, socket recriado. Todas as chaves privadas
  vivem sob `['u', userId, …]`, então nada de um usuário sobrevive no cache do outro.

## 5. Estado do carrinho

- O carrinho vive na API (não no cliente). Visitante: id `guest_<uuid>` em `localStorage` enviado em `X-Cart-Id`.
  Usuário: carrinho da conta. No login/cadastro, `POST /cart/merge` funde o carrinho do visitante na conta (respeitando
  limite por edição e disponibilidade) e o cliente passa a usar um carrinho de visitante novo.
- Mutations do carrinho compartilham `scope: { id: 'cart' }` → executam em série; cliques rápidos em +/− não resolvem
  fora de ordem. Quantidade e remoção são **otimistas** com rollback.
- A cotação (`POST /quote`) é refeita a cada mudança do carrinho (`updatedAt` faz parte da chave) e a cada
  `nft.updated` de item do carrinho. Ela é a referência para finalizar: `POST /orders` envia `quoteVersion`.
- Após confirmação, o servidor remove do carrinho apenas as quantidades compradas; recusa ou falha não tocam no carrinho.

## 6. Cache, retries e sincronização

| Dado | staleTime | Observações |
| --- | --- | --- |
| Catálogo / detalhe | 30 s | `keepPreviousData` na listagem (sem piscar entre páginas/filtros) e indicador "Atualizando…" |
| Carrinho | 10 s | invalidado por mutations, eventos e pedido confirmado |
| Cotação | 0 | sempre fresca; `placeholderData` mantém a anterior visível enquanto recalcula |
| Pedido | padrão | polling 5 s só enquanto `pending` |
| Privados (me, carteiras, favoritos) | 30 s | `enabled` só com sessão |

- **Retry**: queries repetem até 2× com backoff exponencial **somente** para erros transitórios (rede, timeout, 5xx);
  4xx nunca. Mutations não repetem automaticamente — exceto criação de pedido, que repete por idempotência explícita.
- **Respostas obsoletas**: toda query recebe o `AbortSignal` do TanStack Query → mudar filtro cancela a requisição
  anterior; e como a chave inclui os parâmetros, uma resposta tardia só pode cair na entrada do próprio parâmetro
  (teste `jitter` em `e2e/catalog.spec.ts`).
- **Otimismo com rollback**: favoritos (coração muda na hora; falha → volta + toast) e quantidade/remoção no carrinho.
- `refetchOnWindowFocus` ligado: voltar à aba reconcilia o que estiver visível.

## 7. Mocks e cenários

- `src/mocks/db.ts`: seed determinístico (PRNG com semente fixa) — 60 NFTs (as 9 primeiras reproduzem o Figma),
  9 coleções, 3 redes, 4 edições por NFT (`1/1` esgotada em 1/3 do catálogo), 2 usuários, cupons, carteiras da Ana.
  Persistido em `localStorage` (`kurio.mockdb.v1`); `reset` restaura o seed. Pedidos pendentes são retomados após
  refresh a partir do estado persistido (`settleAt`).
- Cenários (`src/mocks/scenarios.ts`) por `?scenario=`, painel "Mock" (ícone de frasco) ou `window.__kurioMock`:
  `default`, `empty`, `slow`, `jitter`, `offline`, `error-500`, `flaky-503`, `favorites-fail`, `session-expired`,
  `price-change`, `sold-out`, `order-timeout`, `payment-declined`, `wallet-rejected`.
- Toda latência usa `setTimeout` → controlável por `page.clock` no Playwright.
- `window.__kurioMock` (testes/demonstração) age **no servidor simulado** (`changePrice`, `setAvailability`,
  `expireSessions`, `replayLastEvent`, `replayStaleEvent`, `outage`), e os efeitos chegam à UI pelo socket/REST.

## 8. Decisões de UX

- **Login/Cadastro**: modal sobre a página no desktop (como no Figma) e tela cheia no mobile. Fechar o modal volta ao
  início. Login social e "Esqueceu a senha?" avisam que não estão disponíveis — não simulam sucesso.
- **Pagamento**: o Figma mistura "dados do colecionador" com campos da carteira. Aqui os dados do colecionador
  (nome, usuário, e-mail, observação) são editáveis e prefilled pelo perfil; os campos da carteira são **somente leitura**
  e vêm da carteira cadastrada escolhida (principal ou "Usar outra carteira?" → secundária). "Rede" é selecionável e
  validada contra a carteira. "Carteira e rede" (WalletConnect/MetaMask/Coinbase) é o conector usado na **simulação de
  conexão**; conector errado ou cenário `wallet-rejected` recusam; há botão de desconectar. Confirmar abre uma revisão.
- **Confirmação**: o Figma desenha só o confirmado, como modal sobre o pagamento. Pendente e recusado seguem o mesmo
  cartão; recusado oferece voltar ao carrinho/tentar de novo. A tela só mostra "Seus NFTs agora estão na sua carteira"
  quando a API diz `confirmed`.
- **Cotação mudou**: toast ao receber `nft.updated` de item do carrinho; na revisão, aviso "Os valores mudaram" e o
  botão vira "Confirmar novos valores". Se a mudança não chegou pelo socket, o servidor recusa com `QUOTE_STALE` e o
  mesmo fluxo de reconfirmação aparece.
- **Faixa de preço**: slider + campos mín./máx. (o slider é impreciso no toque, apontado nos comentários do Figma).
- **Coleções em ordem alfabética** (comentário no Figma); contagens vêm da API e refletem os outros filtros ativos.
- **Ordenação** (não definida no Figma): recentes, menor/maior preço, nome, mais bem avaliados.
- **Galeria**: o Figma mostra 4 miniaturas da mesma arte; aqui são 4 enquadramentos (obra completa e detalhes) da mesma
  imagem, com zoom em diálogo.
- **Tablet (768)**: sem frame no Figma — grid de 3 colunas sem sidebar; filtros em Sheet lateral.
- **Mobile**: barra inferior (Início, Favoritos, Carrinho central com contador, Buscar, Perfil). Perfil, carteiras e
  confirmação (sem frame mobile) reutilizam os componentes empilhados.
- Seções editoriais (Criadores, Aprenda, blog "Ler mais", ajuda, atividade, ofertas, downloads, redes sociais) levam a
  `/em-breve`, que diz claramente que a área não existe. A newsletter valida o e-mail e informa que não houve inscrição.

## 9. Desvios do Figma e ajustes de acessibilidade

- Inconsistências apontadas nos comentários do arquivo foram normalizadas para o padrão dominante: card "Cosmic Bloom"
  com 224×286 (usamos 250×250 como os demais), espaçamento desigual entre fileiras, header com borda só numa tela
  (usamos a borda em todas), botão "−" desabilitado na quantidade mínima.
- `Color/Error #ED1B2E` tem contraste ~4,4:1 sobre `#140D0A` (abaixo de 4,5:1). Mensagens de erro usam `#FF5A5F`.
- Preços riscados, edições esgotadas e itens ativos não dependem só de cor: texto riscado + rótulo "antes", edição
  esgotada com `aria-disabled` + "esgotada" no nome acessível, filtros com `aria-pressed` e marcador visual.
- Os ~40 text styles ad-hoc do Figma foram consolidados em poucos tamanhos Tailwind; a família (Roboto Mono) e as
  cores são as do arquivo.
- Ícones: os SVGs exportados do Figma (`public/icons`) são usados via máscara CSS (`currentColor`); glifos que não
  exportei (coração, olho, lixeira, setas, menu da conta) vêm do `lucide-react`.
- Imagens: os layers chamam-se `NFT Artwork NN`, então os arquivos usam o nome do personagem/NFT em kebab-case. O
  design inteiro usa 4 imagens-fonte (1254 px); exportei os originais e gerei WebP 320/480/640/1254 para `srcset`.
- Login social (Google/Facebook) usa as iniciais coloridas em vez dos logos oficiais.

## 10. Limitações conhecidas

- O MSW inclui `tough-cookie`/`tldts` para emular cookies; a API simulada é por token e nunca define cookies, então o
  pacote é trocado por um stub (`src/mocks/tough-cookie-stub.ts`, alias no `vite.config.ts`) — 120 KB gzip a menos.
  Se algum handler passar a usar `Set-Cookie`, remova o alias.
- Performance mobile fica em 86–88 (meta 90) por causa do backend simulado no caminho crítico — análise em
  [`lighthouse/ANALYSIS.md`](lighthouse/ANALYSIS.md).

- Persistência do mock é por navegador (localStorage); duas abas compartilham o db mas não o estado em memória do
  servidor simulado (timers de liquidação rodam na aba que criou o pedido; a outra reconcilia via REST/polling).
- `__mock/*` e `window.__kurioMock` existem no build de demonstração de propósito (o enunciado pede os mocks no deploy).
- O "Ver no Etherscan" (Polygonscan/Solscan conforme a rede) abre uma URL com hash simulado — o link existe, a transação não.
