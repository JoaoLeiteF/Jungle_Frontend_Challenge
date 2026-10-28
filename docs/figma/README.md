# Figma — coleta de referência

Arquivo: `Ff0SksUi7UFtPWUO8kyNtw` · página **Marketplace de NFTs GreenMint** · marca na UI: **KURIO**.
Coletado em 2026-10-27 via Claude in Chrome (o `FIGMA_TOKEN` não estava definido, então a API REST não foi usada).

## Frames (15)

| Desktop (1440 px) | Altura | Mobile (390 px) |
| --- | ---: | --- |
| `Desktop / Início` | 3668 | `Mobile / Início` |
| `Desktop / Detalhes do NFT` | 2256 | `Mobile / Detalhes do NFT` |
| `Desktop / Carrinho de NFTs` | 1760 | `Mobile / Carrinho de NFTs` |
| `Desktop / Pagamento` | 1664 | `Mobile / Pagamento` |
| `Desktop / Confirmação de Pedido` | 1656 | — (sem frame) |
| `Desktop / Login` (modal sobre Início) | 1984 | `Mobile / Login` (tela cheia) |
| `Desktop / Cadastro` (modal sobre Início) | 1984 | `Mobile / Cadastro` (tela cheia) |
| `Desktop / Perfil do Colecionador` | 1080 | — (sem frame) |
| `Desktop / Carteiras` | 1080 | — (sem frame) |

Recortes 1x de cada frame estão nesta pasta (`desktop-*.png`, `mobile-*.png`), extraídos de `Export/Frontend Challenge.png`.

## Layout

- Frame desktop: 1440 de largura, padding 24/120, gap vertical 96 entre seções → conteúdo com **1200 px**.
- Hero: imagem 450×450, raio 24. Cards do catálogo: imagem 250×250, raio 15. NFT em destaque: 310×368, raio 22.
- Grid do catálogo: 3 colunas, gap de seção 48 (sidebar + grid).

## Tipografia

Família única: **Roboto Mono** (variável `font/family`). Escala usada (nome do style · tamanho/altura de linha):

- Display: 43 Bold · 43/70 (título do hero), 32 Bold
- Heading: 28 / 26 / 24 Bold
- Title: 23–20 (Bold/Medium/Regular)
- Body Large: 19–16 (Bold/Medium/Regular/Light) — links do nav 16, botões 16 Bold/20
- Body: 15–14 — "Bem-vindo à Kurio" 14 Medium com tracking 10%, wordmark KURIO 14 Bold tracking 10%
- Caption / Tiny: < 14

O arquivo tem ~40 text styles ad-hoc; a implementação consolida numa escala menor (ver `src/styles`).

## Cores (color styles → variáveis)

| Style | Hex | Variável |
| --- | --- | --- |
| Color/Primary | `#D28A4C` | color/primary |
| Color/Primary Light | `#DD9A5F` | color/primary-light |
| Color/Primary Dark | `#C47B3E` | color/primary-dark |
| Color/Amber | `#E3A44E` | color/amber |
| Color/Secondary | `#B39463` | color/secondary |
| Color/Foreground | `#F5F1EB` | color/background (sic) |
| Color/Background Elevated | `#FBFBFB` | color/background-elevated |
| Color/Ink (fundo da página) | `#140D0A` | color/ink |
| Color/Surface Card | `#241612` | color/text-primary (sic) |
| Color/Surface Raised | `#2F1D15` | color/text-secondary (sic) |
| Color/Surface Dark (faixa do rodapé) | `#38220F` | color/surface-dark |
| Color/Border | `#3F2319` | color/border |
| Color/Border Soft | `#55321F` | color/border-soft |
| Color/Gray Light | `#EDEDED` | color/gray-light |
| Color/Success | `#00A66C` | color/success |
| Color/Error | `#ED1B2E` | color/error |
| Text/Accent (nav ativo, preços) | `#E89B55` | color/text-accent |
| Text/Secondary | `#CFB28C` | color/text-secondary |
| Text/Coral | `#EA6B4F` | color/accent |
| Text/Primary | — | "creme mais quente, legado da paleta antiga" |
| Logo/Orange | `#FF641A` | logo/orange |
| Logo/Facebook, Logo/Google Blue | — | logos de login social |

Os nomes das variáveis têm inconsistências (ex.: Surface Card ligado a `color/text-primary`). A implementação usa o **hex** e nomes semânticos próprios.

## Notas embutidas nos componentes

- `Footer`: "Conteúdo idêntico em todas as telas; em telas com scrim de modal o footer fica **abaixo** do scrim."
- `Header Row` é componente compartilhado (nav ativo em `Text/Accent`, sublinhado).

## Comentários do arquivo (outros candidatos) — pontos que afetam a implementação

- Só o estado **confirmado** do pedido está desenhado; pendente/recusado precisam seguir o mesmo padrão.
- Não há frame mobile de confirmação, perfil, carteiras, nem referência de tablet.
- Opções de ordenação não estão definidas no layout.
- Slider de preço tem problema de precisão no mobile → usar também campos min/max.
- Coleções fora de ordem alfabética.
- Botão "−" de quantidade deveria ficar desabilitado no mínimo (1).
- Header de uma tela tem border-bottom e as outras não; vários desalinhamentos/margens não uniformes
  (ex.: card "Cosmic Bloom #118" 224×286 em vez de 250×250; espaçamento entre fileiras desigual).
- ENS só faz sentido em Ethereum.

Esses desvios são normalizados na implementação e listados em `ARCHITECTURE.md`.

## Assets

Imagens raster: o design inteiro usa **4 imagens-fonte** (1254×1254). Hero, cards, destaque, promoções, blog e galeria
são recortes delas. Os layers chamam-se `NFT Artwork NN` (genérico), então os arquivos usam o nome do NFT em kebab-case:

| Arquivo | Hash da imagem no Figma | Personagem |
| --- | --- | --- |
| `public/images/nft/emerald-ape-{320,640,1254}.webp` | `8459204731e6…` | macaco marrom, óculos, jaqueta verde |
| `public/images/nft/sage-nomad-*.webp` | `2986a7cb16d0…` | gorila, chapéu bucket, moletom roxo |
| `public/images/nft/neon-vessel-*.webp` | `9df2ff42dd27…` | gorila preto, gola alta |
| `public/images/nft/golden-beat-*.webp` | `87580f2def9a…` | macaco dourado, headphone |

Ícones SVG (`public/icons/`, `fill="currentColor"`): `arrow-down`, `message`, `x`, `search`, `shop`, `user`
(exportados do arquivo) e `facebook`, `instagram`, `twitter`, `linkedin`, `youtube` (rodapé; borda removida —
a moldura é CSS). Demais glifos de UI usam `lucide-react` (substituição documentada em `ARCHITECTURE.md`).
