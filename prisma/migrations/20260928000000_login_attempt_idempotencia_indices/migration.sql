-- Idempotente (IF NOT EXISTS): seguro mesmo se produção recebeu parte disso via `db push`.

-- LoginAttempt (rate limit do login) — existia no schema mas nunca teve migration
CREATE TABLE IF NOT EXISTS "LoginAttempt" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ip" TEXT,
    "sucesso" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "LoginAttempt_email_createdAt_idx" ON "LoginAttempt"("email", "createdAt");
CREATE INDEX IF NOT EXISTS "LoginAttempt_ip_createdAt_idx" ON "LoginAttempt"("ip", "createdAt");
CREATE INDEX IF NOT EXISTS "LoginAttempt_createdAt_idx" ON "LoginAttempt"("createdAt");

-- Índices declarados no schema sem migration
CREATE INDEX IF NOT EXISTS "Produto_ativo_deletedAt_quantidadeMinima_quantidade_idx" ON "Produto"("ativo", "deletedAt", "quantidadeMinima", "quantidade");
CREATE INDEX IF NOT EXISTS "ItemVenda_vendaId_produtoId_idx" ON "ItemVenda"("vendaId", "produtoId");
CREATE INDEX IF NOT EXISTS "Pagamento_vendaId_metodo_idx" ON "Pagamento"("vendaId", "metodo");
CREATE INDEX IF NOT EXISTS "MovimentoEstoque_usuarioId_idx" ON "MovimentoEstoque"("usuarioId");
CREATE INDEX IF NOT EXISTS "EntradaXml_importadoPorId_idx" ON "EntradaXml"("importadoPorId");
CREATE INDEX IF NOT EXISTS "EntradaXml_importadoEm_idx" ON "EntradaXml"("importadoEm");

-- Venda: chave de idempotência (anti venda duplicada)
ALTER TABLE "Venda" ADD COLUMN IF NOT EXISTS "chaveIdempotencia" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Venda_chaveIdempotencia_key" ON "Venda"("chaveIdempotencia");
