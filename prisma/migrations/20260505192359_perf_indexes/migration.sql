-- CreateIndex
CREATE INDEX "Documento_tipo_emitidoEm_idx" ON "Documento"("tipo", "emitidoEm");

-- CreateIndex
CREATE INDEX "Documento_emitidoPorId_idx" ON "Documento"("emitidoPorId");

-- CreateIndex
CREATE INDEX "Produto_ativo_deletedAt_nome_idx" ON "Produto"("ativo", "deletedAt", "nome");

-- CreateIndex
CREATE INDEX "Produto_categoriaId_ativo_idx" ON "Produto"("categoriaId", "ativo");

-- CreateIndex
CREATE INDEX "Venda_status_createdAt_idx" ON "Venda"("status", "createdAt");
