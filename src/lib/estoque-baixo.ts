import { prisma } from "@/lib/prisma";

/**
 * Produtos ativos com estoque <= mínimo, os mais críticos primeiro.
 * Filtro coluna-a-coluna feito no SQL (o ORM não suporta) — antes buscava os
 * 50 primeiros em ordem alfabética e filtrava em JS, perdendo o resto.
 */
export function produtosAbaixoDoMinimo(limite: number) {
  return prisma.$queryRaw<
    { id: string; nome: string; quantidade: string; quantidadeMinima: string; unidade: string }[]
  >`
    SELECT id, nome,
           quantidade::text AS quantidade,
           "quantidadeMinima"::text AS "quantidadeMinima",
           unidade::text AS unidade
    FROM "Produto"
    WHERE ativo = true AND "deletedAt" IS NULL
      AND "quantidadeMinima" > 0
      AND quantidade <= "quantidadeMinima"
    ORDER BY quantidade / "quantidadeMinima" ASC, nome ASC
    LIMIT ${limite}
  `;
}
