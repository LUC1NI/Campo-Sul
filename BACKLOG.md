# Backlog de qualidade — CampoSul

Levantado em 2026-09-29 (auditoria geral). Marque `[x]` ao concluir, com o commit.

## P0 — bloqueia produção
- [x] **Dependências vulneráveis** — 44 → 1. Removidos 18 pacotes sem uso + Netlify; next 15.5.26, next-auth beta.32, fast-xml-parser 5 (coberto por `tests/nfe-xml-parser.test.ts`), overrides p/ postcss/nanoid/sharp.
  - Risco aceito: `deepmerge-ts` (high) fixado pelo Prisma 6 CLI; só lê config local, sem entrada de usuário. Some ao migrar p/ Prisma 7.
  - Login com next-auth beta.32 precisa ser re-testado no E2E abaixo.
- [ ] **Teste ponta a ponta com banco real** — login, venda (inteira + fracionada), PDF nota/recibo, cancelamento, importação XML. *Bloqueado: banco da cliente* (`prisma/setup-supabase.sql`).
- [ ] **Backup do banco** — Supabase free não tem backup baixável. `pg_dump` diário via GitHub Actions (custo zero). *Bloqueado: banco da cliente.*

## P1 — qualidade profissional
- [x] **CI** — `.github/workflows/ci.yml`: typecheck + lint + testes + audit (high) em push/PR. Build fica com o Vercel.
- [x] **Testes de integração** — `tests/vendas.integration.test.ts`: venda inteira/fracionada, preço do catálogo, idempotência, produto inativo, cancelamento (estoque exato, duplo cancelamento, permissão). Postgres real via PGlite, sem Docker. Validado com teste de mutação.
- [ ] **Testes de integração — importação XML/TXT e usuários** (próxima leva).
- [ ] **Monitoramento de erros em produção** — hoje só descobrimos erro quando a cliente reclama.

## P2 — produto, UX, legal
- [ ] **LGPD** — CPF de clientes armazenado: política de privacidade + prazo de retenção.
- [ ] **Acessibilidade/UX do PDV** — auditoria WCAG + teste com a operadora de caixa.
- [ ] **Documento não fiscal** — termo de ciência por escrito com a cliente (risco se usar como NF).
