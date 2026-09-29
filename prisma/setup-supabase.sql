-- ============================================================================
-- CampoSul — setup completo do banco (Supabase / PostgreSQL)
-- Gerado de prisma/schema.prisma em 2026-09-29.
--
-- COMO USAR (banco NOVO e vazio):
--   1. Troque o e-mail e a senha do admin logo abaixo (CONFIGURAÇÃO).
--   2. Supabase → SQL Editor → cole tudo → Run.
--   Tudo roda numa transação: se algo falhar, nada é criado.
--
-- Não rode num banco que já tem as tabelas (vai dar erro "already exists").
-- Mudanças futuras de schema: `pnpm prisma migrate deploy` normalmente.
-- ============================================================================

-- ── CONFIGURAÇÃO ── troque aqui (senha: mínimo 8 caracteres) ───────────────
SELECT set_config('camposul.admin_email', 'admin@camposul.com.br', false),
       set_config('camposul.admin_senha', 'TROQUE-ESTA-SENHA', false);

DO $$
BEGIN
  IF current_setting('camposul.admin_senha') = 'TROQUE-ESTA-SENHA'
     OR length(current_setting('camposul.admin_senha')) < 8 THEN
    RAISE EXCEPTION 'Defina a senha do admin em CONFIGURAÇÃO (topo do arquivo) antes de rodar.';
  END IF;
END $$;

BEGIN;

-- CreateSchema

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'FUNCIONARIO');

-- CreateEnum
CREATE TYPE "Unidade" AS ENUM ('UN', 'KG', 'L', 'SACO', 'CX', 'M');

-- CreateEnum
CREATE TYPE "MetodoPagamento" AS ENUM ('DINHEIRO', 'DEBITO', 'CREDITO', 'PIX');

-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('NOTA', 'RECIBO');

-- CreateEnum
CREATE TYPE "StatusDocumento" AS ENUM ('EMITIDO', 'ERRO_PDF');

-- CreateEnum
CREATE TYPE "StatusVenda" AS ENUM ('CONCLUIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoMovimentoEstoque" AS ENUM ('ENTRADA_XML', 'ENTRADA_MANUAL', 'SAIDA_VENDA', 'AJUSTE', 'CANCELAMENTO_VENDA');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'FUNCIONARIO',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Produto" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "gtin" TEXT,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "categoriaId" TEXT,
    "unidade" "Unidade" NOT NULL,
    "precoCusto" DECIMAL(14,4) NOT NULL,
    "precoVenda" DECIMAL(14,4) NOT NULL,
    "podeFracionar" BOOLEAN NOT NULL DEFAULT false,
    "pesoUnidade" DECIMAL(14,4),
    "unidadeFracao" "Unidade",
    "precoFracao" DECIMAL(14,4),
    "quantidade" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "saldoFracionado" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "quantidadeMinima" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Produto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venda" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "status" "StatusVenda" NOT NULL DEFAULT 'CONCLUIDA',
    "subtotal" DECIMAL(14,2) NOT NULL,
    "desconto" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL,
    "observacao" TEXT,
    "usuarioId" TEXT NOT NULL,
    "descontouEstoque" BOOLEAN NOT NULL DEFAULT true,
    "chaveIdempotencia" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Venda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemVenda" (
    "id" TEXT NOT NULL,
    "vendaId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "nomeProduto" TEXT NOT NULL,
    "unidadeVenda" "Unidade" NOT NULL,
    "quantidade" DECIMAL(14,4) NOT NULL,
    "precoUnitario" DECIMAL(14,4) NOT NULL,
    "desconto" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL,
    "unidadesFechadasConsumidas" DECIMAL(14,4) NOT NULL DEFAULT 0,

    CONSTRAINT "ItemVenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pagamento" (
    "id" TEXT NOT NULL,
    "vendaId" TEXT NOT NULL,
    "metodo" "MetodoPagamento" NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "Pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Documento" (
    "id" TEXT NOT NULL,
    "tipo" "TipoDocumento" NOT NULL,
    "numero" INTEGER NOT NULL,
    "serie" TEXT NOT NULL DEFAULT '1',
    "vendaId" TEXT NOT NULL,
    "cpfCnpj" TEXT,
    "nomeCliente" TEXT,
    "pdfPath" TEXT,
    "statusDoc" "StatusDocumento" NOT NULL DEFAULT 'EMITIDO',
    "erroInfo" TEXT,
    "emitidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reemitidoEm" TIMESTAMP(3),
    "emitidoPorId" TEXT NOT NULL,

    CONSTRAINT "Documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Counter" (
    "chave" TEXT NOT NULL,
    "valor" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Counter_pkey" PRIMARY KEY ("chave")
);

-- CreateTable
CREATE TABLE "MovimentoEstoque" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "tipo" "TipoMovimentoEstoque" NOT NULL,
    "quantidade" DECIMAL(14,4) NOT NULL,
    "saldoApos" DECIMAL(14,4) NOT NULL,
    "precoCusto" DECIMAL(14,4),
    "referenciaId" TEXT,
    "observacao" TEXT,
    "usuarioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimentoEstoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ip" TEXT,
    "sucesso" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntradaXml" (
    "id" TEXT NOT NULL,
    "chaveAcesso" TEXT NOT NULL,
    "numeroNf" TEXT NOT NULL,
    "cnpjEmitente" TEXT NOT NULL,
    "nomeEmitente" TEXT NOT NULL,
    "valorTotal" DECIMAL(14,2) NOT NULL,
    "xmlOriginal" TEXT NOT NULL,
    "importadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importadoPorId" TEXT NOT NULL,

    CONSTRAINT "EntradaXml_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemEntradaXml" (
    "id" TEXT NOT NULL,
    "entradaId" TEXT NOT NULL,
    "produtoId" TEXT,
    "gtin" TEXT,
    "descricao" TEXT NOT NULL,
    "quantidade" DECIMAL(14,4) NOT NULL,
    "valorUnitario" DECIMAL(14,4) NOT NULL,
    "valorTotal" DECIMAL(14,2) NOT NULL,
    "criouProduto" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ItemEntradaXml_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_email_idx" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_nome_key" ON "Categoria"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Produto_codigo_key" ON "Produto"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Produto_gtin_key" ON "Produto"("gtin");

-- CreateIndex
CREATE INDEX "Produto_nome_idx" ON "Produto"("nome");

-- CreateIndex
CREATE INDEX "Produto_codigo_idx" ON "Produto"("codigo");

-- CreateIndex
CREATE INDEX "Produto_gtin_idx" ON "Produto"("gtin");

-- CreateIndex
CREATE INDEX "Produto_ativo_deletedAt_nome_idx" ON "Produto"("ativo", "deletedAt", "nome");

-- CreateIndex
CREATE INDEX "Produto_categoriaId_ativo_idx" ON "Produto"("categoriaId", "ativo");

-- CreateIndex
CREATE INDEX "Produto_ativo_deletedAt_quantidadeMinima_quantidade_idx" ON "Produto"("ativo", "deletedAt", "quantidadeMinima", "quantidade");

-- CreateIndex
CREATE UNIQUE INDEX "Venda_numero_key" ON "Venda"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "Venda_chaveIdempotencia_key" ON "Venda"("chaveIdempotencia");

-- CreateIndex
CREATE INDEX "Venda_createdAt_idx" ON "Venda"("createdAt");

-- CreateIndex
CREATE INDEX "Venda_usuarioId_idx" ON "Venda"("usuarioId");

-- CreateIndex
CREATE INDEX "Venda_status_createdAt_idx" ON "Venda"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ItemVenda_vendaId_idx" ON "ItemVenda"("vendaId");

-- CreateIndex
CREATE INDEX "ItemVenda_produtoId_idx" ON "ItemVenda"("produtoId");

-- CreateIndex
CREATE INDEX "ItemVenda_vendaId_produtoId_idx" ON "ItemVenda"("vendaId", "produtoId");

-- CreateIndex
CREATE INDEX "Pagamento_vendaId_idx" ON "Pagamento"("vendaId");

-- CreateIndex
CREATE INDEX "Pagamento_vendaId_metodo_idx" ON "Pagamento"("vendaId", "metodo");

-- CreateIndex
CREATE UNIQUE INDEX "Documento_vendaId_key" ON "Documento"("vendaId");

-- CreateIndex
CREATE INDEX "Documento_emitidoEm_idx" ON "Documento"("emitidoEm");

-- CreateIndex
CREATE INDEX "Documento_tipo_emitidoEm_idx" ON "Documento"("tipo", "emitidoEm");

-- CreateIndex
CREATE INDEX "Documento_emitidoPorId_idx" ON "Documento"("emitidoPorId");

-- CreateIndex
CREATE UNIQUE INDEX "Documento_tipo_numero_serie_key" ON "Documento"("tipo", "numero", "serie");

-- CreateIndex
CREATE INDEX "MovimentoEstoque_produtoId_createdAt_idx" ON "MovimentoEstoque"("produtoId", "createdAt");

-- CreateIndex
CREATE INDEX "MovimentoEstoque_usuarioId_idx" ON "MovimentoEstoque"("usuarioId");

-- CreateIndex
CREATE INDEX "LoginAttempt_email_createdAt_idx" ON "LoginAttempt"("email", "createdAt");

-- CreateIndex
CREATE INDEX "LoginAttempt_ip_createdAt_idx" ON "LoginAttempt"("ip", "createdAt");

-- CreateIndex
CREATE INDEX "LoginAttempt_createdAt_idx" ON "LoginAttempt"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EntradaXml_chaveAcesso_key" ON "EntradaXml"("chaveAcesso");

-- CreateIndex
CREATE INDEX "EntradaXml_importadoPorId_idx" ON "EntradaXml"("importadoPorId");

-- CreateIndex
CREATE INDEX "EntradaXml_importadoEm_idx" ON "EntradaXml"("importadoEm");

-- AddForeignKey
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemVenda" ADD CONSTRAINT "ItemVenda_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemVenda" ADD CONSTRAINT "ItemVenda_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_emitidoPorId_fkey" FOREIGN KEY ("emitidoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemEntradaXml" ADD CONSTRAINT "ItemEntradaXml_entradaId_fkey" FOREIGN KEY ("entradaId") REFERENCES "EntradaXml"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemEntradaXml" ADD CONSTRAINT "ItemEntradaXml_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ── Segurança Supabase ──────────────────────────────────────────────────────
-- O app acessa via Prisma (usuário postgres, ignora RLS). Ligar RLS sem
-- policies bloqueia a API pública do Supabase (anon/authenticated) de ler
-- as tabelas com a chave anon.
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ── Histórico do Prisma ─────────────────────────────────────────────────────
-- Marca as migrations existentes como aplicadas, para `prisma migrate deploy`
-- futuro aplicar só as novas.
CREATE TABLE "_prisma_migrations" (
    "id"                  VARCHAR(36) PRIMARY KEY NOT NULL,
    "checksum"            VARCHAR(64) NOT NULL,
    "finished_at"         TIMESTAMPTZ,
    "migration_name"      VARCHAR(255) NOT NULL,
    "logs"                TEXT,
    "rolled_back_at"      TIMESTAMPTZ,
    "started_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, applied_steps_count) VALUES
  (gen_random_uuid()::text, 'faead671400c5c1a0f6b52977980219e166b4fa2c4e9a4edd63e21d990565e68', now(), '20260429193747_init', 1),
  (gen_random_uuid()::text, '6bc62b8afccf61433cad8040ffd81d966d9639394f578fb727117f8d0e3c7d63', now(), '20260430000001_add_status_documento', 1),
  (gen_random_uuid()::text, '0773947c597b01ff5a2482de5ea07bf5b85fef4f38fcb6342a22fb0bfd18d7ac', now(), '20260505192359_perf_indexes', 1),
  (gen_random_uuid()::text, '196bf5aead904ab013d3c2da03fcf79420b9953d1a63750ebf8df14ddcea667b', now(), '20260507001716_add_descontou_estoque', 1),
  (gen_random_uuid()::text, '1de10137878be95379100acb0c3c420b6b3ec809f3125528419070ef47897342', now(), '20260928000000_login_attempt_idempotencia_indices', 1);

-- ── Dados iniciais ──────────────────────────────────────────────────────────
-- IDs no formato aceito pela validação cuid do app ('c' + 32 hex).
INSERT INTO "Counter" ("chave", "valor") VALUES ('VENDA', 0), ('NOTA:1', 0), ('RECIBO:1', 0);

INSERT INTO "Categoria" ("id", "nome")
SELECT 'c' || replace(gen_random_uuid()::text, '-', ''), nome
FROM unnest(ARRAY['Rações', 'Sementes', 'Medicamentos', 'Ferramentas', 'Insumos', 'Outros']) AS nome;

-- ── ADMIN (e-mail/senha definidos em CONFIGURAÇÃO) ──────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
INSERT INTO "Usuario" ("id", "email", "nome", "senhaHash", "role", "updatedAt")
VALUES (
  'c' || replace(gen_random_uuid()::text, '-', ''),
  lower(current_setting('camposul.admin_email')),
  'Administrador',
  extensions.crypt(current_setting('camposul.admin_senha'), extensions.gen_salt('bf', 12)),  -- bcrypt, compatível com bcryptjs
  'ADMIN',
  now()
);

-- Não deixa a senha na sessão.
SELECT set_config('camposul.admin_senha', '', false);

-- ── Storage (PDFs de notas/recibos) ─────────────────────────────────────────
-- Bucket privado; o app usa a service role e gera URLs assinadas.
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos', 'documentos', false)
ON CONFLICT (id) DO NOTHING;

COMMIT;
