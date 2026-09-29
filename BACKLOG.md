# Backlog de qualidade — CampoSul

Levantado em 2026-09-29 (auditoria geral). Marque `[x]` ao concluir, com o commit.

## P0 — bloqueia produção
- [ ] **Dependências vulneráveis** — `pnpm audit --prod`: 44 (5 críticas, 21 altas). next-auth/@auth/core (login), next, fast-xml-parser (XML NF-e), sharp, ws, postcss.
- [ ] **Teste ponta a ponta com banco real** — login, venda (inteira + fracionada), PDF nota/recibo, cancelamento, importação XML. *Bloqueado: banco da cliente* (`prisma/setup-supabase.sql`).
- [ ] **Backup do banco** — Supabase free não tem backup baixável. `pg_dump` diário via GitHub Actions (custo zero). *Bloqueado: banco da cliente.*

## P1 — qualidade profissional
- [ ] **CI** — GitHub Actions: typecheck + lint + testes + audit em todo push/PR.
- [ ] **Testes de integração** — Server Actions de venda, cancelamento e importação (hoje só lógica pura é testada).
- [ ] **Monitoramento de erros em produção** — hoje só descobrimos erro quando a cliente reclama.

## P2 — produto, UX, legal
- [ ] **LGPD** — CPF de clientes armazenado: política de privacidade + prazo de retenção.
- [ ] **Acessibilidade/UX do PDV** — auditoria WCAG + teste com a operadora de caixa.
- [ ] **Documento não fiscal** — termo de ciência por escrito com a cliente (risco se usar como NF).
