-- Memória por fornecedor na importação de NF-e (código do produto no fornecedor + fator de conversão)
ALTER TABLE "ItemEntradaXml" ADD COLUMN IF NOT EXISTS "codigoFornecedor" TEXT;
ALTER TABLE "ItemEntradaXml" ADD COLUMN IF NOT EXISTS "fatorConversao" DECIMAL(14,6) NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS "ItemEntradaXml_codigoFornecedor_idx" ON "ItemEntradaXml"("codigoFornecedor");
CREATE INDEX IF NOT EXISTS "ItemEntradaXml_produtoId_idx" ON "ItemEntradaXml"("produtoId");
