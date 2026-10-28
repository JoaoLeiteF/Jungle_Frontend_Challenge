# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Kurio, an NFT marketplace built for the Jungle Gaming frontend challenge. The challenge statement is in
`docs/challenge/README.md` (Portuguese) and is the source of truth for behavior and scoring; the Figma reference
(tokens, frames, asset provenance, known design inconsistencies) is summarized in `docs/figma/README.md` with 1x crops
of every frame next to it. The design/SDD is `docs/superpowers/specs/2026-10-27-kurio-marketplace-design.md`.
UI copy is Brazilian Portuguese.

## Commands

```bash
npm run dev               # Vite dev server with MSW mocks (REST + Socket.IO) on :5173
npm run build             # tsc -b && vite build (mocks stay enabled: the deploy is a demo build)
npm run preview           # serve dist on :4173
npm run typecheck         # tsc -b --noEmit
npm run lint
npm run test:e2e          # Playwright (starts its own server); single test: npx playwright test e2e/cart.spec.ts -g "coupon"
npm run test:e2e:update   # refresh visual baselines
npm run audit:lighthouse  # LHCI, 3 runs per page/profile, config in lighthouse/
```

## Architecture (big picture)

- **No real backend.** Everything behind `/api` and the socket at `VITE_SOCKET_URL` is simulated by MSW in
  `src/mocks/` (`db.ts` state + seed persisted in localStorage, `handlers.ts` REST, `realtime.ts` Socket.IO server via
  `@mswjs/socket.io-binding`, `scenarios.ts` latency/failure scenarios). App code must never import from `src/mocks/`
  or contain fake responses — that is disqualifying in the challenge. Mutations in the mock db must emit the matching
  socket event (`touchNft` / `emitOrderUpdated`).
- **Boot order matters**: `src/main.tsx` loads MSW and `src/app/mount.tsx` in parallel but mounts only after the worker
  is active. engine.io-client captures `globalThis.WebSocket` when evaluated, so `socket.io-client` must stay a lazy
  import inside `RealtimeBridge` — a static import anywhere in the app graph silently bypasses the socket mock.
- `tough-cookie` is aliased to a stub (`src/mocks/tough-cookie-stub.ts`) to keep MSW small; the mock API is token-based.
- **Layers**: `src/api/` (Axios instance + zod contracts shared with the mocks; every response is schema-parsed) →
  `src/features/*/queries.ts` (TanStack Query options/mutations) → components. `src/components/` is leaf UI with no
  business deps; the app shell that reads session/cart lives in `src/app/shell/`; the mock panel is demo tooling in
  `src/devtools/`, lazy-loaded only when mocks are on (it may log in the seed user and fill the cart through the API). `src/app/session.ts` is an external
  store (useSyncExternalStore) so router guards, the Axios 401 interceptor and the socket share one session.
- **Query keys are scoped** (`src/app/query.ts`): public `['nfts', …]`, private `['u', userId, …]`, guest
  `['guest', cartId, …]`. Logout/expiry/user switch removes `['u']` and `['guest']` — keep new private data under `['u']`.
- **Realtime** (`src/realtime/`): one socket per session token; `gate.ts` dedupes by `eventId` and drops versions
  ≤ last seen/cached; reconnect invalidates active queries (REST reconciliation); `order.updated` for another userId is
  ignored.
- **Money**: ETH amounts are decimal strings; use `src/lib/eth.ts` (BigInt wei). Never `Number()` prices except for
  the slider UI. Totals come from the API quote (`POST /quote`), never computed in components.
- **Catalog state is in the URL** (`catalogSearchSchema` in `src/app/router.tsx`, comma-separated lists); any filter
  change resets `page`.
- Orders: `POST /orders` needs an `Idempotency-Key`; same key + same body returns the same order, different body → 409.
  A changed quote returns 409 `QUOTE_STALE` with the fresh quote in `error.details.quote`.

## Conventions

- Design tokens live in `src/styles/index.css` (`@theme`). `highlight` = Figma Text/Accent `#E89B55`; shadcn's
  `accent` is a background token, don't confuse them. Font is Roboto Mono everywhere.
- shadcn/ui components are in `src/components/ui/` (restyled). Figma SVG icons are in `public/icons/` and rendered with
  `<Icon name>` (CSS mask, `currentColor`); other glyphs use `lucide-react`.
- Raster art: 4 sources in `public/images/nft/<name>-{320,480,640,1254}.webp`, always rendered through `<NftImage>` (srcset).
- Mock scenarios: `?scenario=<name>`, the floating Mock panel, or `window.__kurioMock` (used by Playwright).
  Seed users: `ana@kurio.test` / `bruno@kurio.test`, password `Kurio@123`.
