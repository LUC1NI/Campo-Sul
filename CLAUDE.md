# CampoSul — Contexto para Claude Code

## Sobre o projeto
Sistema de gestão para agropecuária CampoSul (RS). Inclui site institucional + PDV + estoque + notas/recibos PDF + relatórios. Dev solo (lucinij3@gmail.com). Custo zero de infra.

## Stack (não mudar sem justificativa forte)
- **Next.js 15** App Router + TypeScript strict + Node 22
- **PostgreSQL** via Supabase free + **Prisma 6**
- **Auth.js v5** Credentials + bcryptjs (sessão 30 dias)
- **Tailwind CSS 3** + **shadcn/ui** — paleta terrosa/verde CampoSul
- **Zustand** (carrinho persist localStorage)
- **React Hook Form + Zod** (forms + validação)
- **@react-pdf/renderer** (PDFs server-side)
- **fast-xml-parser** (parser NF-e XML SEFAZ)
- **Vercel Hobby** (free) + **Supabase Storage** (free 1GB)

## Comandos
```bash
pnpm dev                              # dev server
pnpm build                            # build prod
pnpm test:run                         # testes (vitest)
pnpm prisma migrate dev --name <nome> # migration
pnpm prisma db push                   # sync schema (dev)
pnpm prisma studio                    # GUI do banco
pnpm prisma db seed                   # seed inicial
```

## Variáveis de ambiente (.env.local) — criar a partir de .env.example
- DATABASE_URL — pooled PgBouncer
- DIRECT_DATABASE_URL — direta p/ migrations
- NEXTAUTH_SECRET — `openssl rand -base64 32`
- NEXTAUTH_URL — http://localhost:3000
- SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_BUCKET
- SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD
- EMPRESA_RAZAO_SOCIAL, EMPRESA_CNPJ, EMPRESA_IE, EMPRESA_ENDERECO, EMPRESA_FONE

## Identidade Visual
- Cores: `verde-mata: #2d4a2b`, `verde-claro: #5a7a3e`, `terra: #8b5a3c`, `bege: #f4ead5`, `off-white: #faf7f0`
- Tipografia: Fraunces (headings) + Inter (body)

## Convenções críticas
- **Dinheiro**: sempre `Prisma.Decimal` ou `string` até o frontend — NUNCA `number` para valores monetários no banco
- **Datas**: date-fns + locale ptBR. Banco UTC, exibição America/Sao_Paulo
- **Server Actions**: em `src/app/actions/` — sempre validam com Zod no entry point
- **Mutations de venda/estoque**: sempre em `prisma.$transaction` com `isolationLevel: Serializable`
- **Strings UI**: sempre em pt-BR

## Regras de negócio críticas
- **Fracionamento**: ver `src/lib/fracionamento.ts`. Saldo fracionado acumula → quando >= pesoUnidade, desconta 1 unidade do estoque. Testes em `tests/fracionamento.test.ts`
- **Numeração NF**: counter atômico em tabela `Counter` via UPDATE...RETURNING. Ver `src/lib/numeracao-nf.ts`
- **NF-e**: documento NÃO É FISCAL — é DANFE simplificado. Não transmite para SEFAZ na v1
- **Estoque**: nunca decrementar fora de transação. Sempre criar `MovimentoEstoque`

## Estrutura de páginas
```
/                   → Landing institucional (pública)
/login              → Login (pública)
/dashboard          → Dashboard com resumo do dia (admin/func)
/vendas             → PDV principal (admin/func)
/vendas/historico   → Histórico de vendas (admin/func)
/estoque            → Listagem de produtos (admin/func)
/estoque/novo       → Cadastrar produto (admin/func)
/estoque/[id]       → Editar produto (admin/func)
/estoque/importar-xml → Upload de XML NF-e (admin)
/notas              → Listagem de notas e recibos (admin/func)
/relatorios         → Relatórios e indicadores (admin)
/usuarios           → Gerenciar usuários (admin)

/api/pdf/nota/[id]  → Gera/serve PDF da nota
/api/pdf/recibo/[id]→ Mesmo handler
/api/produtos/buscar → Busca de produtos para PDV
/api/produtos/[id]  → GET produto por ID
```

## Arquivos-âncora (ler ao retomar sessão)
1. `prisma/schema.prisma` — schema completo do banco
2. `src/lib/fracionamento.ts` — lógica crítica de venda por peso
3. `src/lib/numeracao-nf.ts` — numeração atômica de documentos
4. `src/app/actions/vendas.ts` — Server Action de finalizar venda
5. `src/stores/carrinho-store.ts` — estado do PDV (Zustand)

## Fases do projeto
- [x] Fase 0: Bootstrap (Next.js setup, schema, CLAUDE.md, libs base)
- [x] Fase 1: Auth + shell
- [x] Fase 2: CRUD Estoque
- [x] Fase 3: PDV — 11/11 testes passando
- [x] Fase 4: PDF (geração de nota e recibo funcionando)
- [x] Fase 5: Importação XML NF-e
- [x] Fase 6: Relatórios
- [x] Fase 7: Polimento UI do site institucional
- [ ] Fase 8: Deploy Vercel + hardening

## Estado atual (2026-04-30)
Fases 0–7 concluídas. `/usuarios` implementado. Build produção OK. 11/11 testes passando.

**PRÓXIMO PASSO — para rodar o sistema:**
1. Copiar `.env.local` a partir de `.env.example` e preencher credenciais Supabase
2. `pnpm prisma migrate dev --name init`
3. `pnpm prisma db seed`
4. `pnpm dev` → http://localhost:3000

**Pendente antes do deploy (Fase 8):**
- [ ] Paginação + filtros na listagem `/notas` (hoje trava em 100 registros)
- [ ] Vercel deploy + variáveis de ambiente em produção

## Decisões e débitos técnicos
- `src/app/(app)/` route group planejado mas implementado como AppLayout componente importado em cada página (evita conflito de rota). Funciona igual.
- `pnpm dlx shadcn@latest init` não foi rodado — shadcn components devem ser instalados manualmente conforme necessário
- Import alias `@react-pdf/renderer` usa `renderToBuffer` (server-side) — não importar em Client Components
- A imagem hero da landing usa pattern SVG inline — substituir por foto real de campo em produção
- Fontes NotoSans hospedadas localmente em `public/fonts/` (Regular + Bold TTF). `recibo-doc.tsx` usa `path.join(process.cwd(), "public", "fonts", ...)` — sem dependência de CDN externo
