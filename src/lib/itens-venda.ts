import type { Unidade } from "@prisma/client";
import { Decimal } from "decimal.js";
import type { transacaoSerializavel } from "@/lib/prisma";
import { calcularFracionamento } from "@/lib/fracionamento";
import { ehVendaInteira, precoDeCatalogo, totalItem } from "@/lib/venda-calculo";

type Tx = Parameters<Parameters<typeof transacaoSerializavel>[0]>[0];

export interface ItemEntrada {
  produtoId: string;
  unidadeVenda: Unidade;
  quantidade: number;
  /** Só é respeitado quando `precoLivre` (admin). Caso contrário vale o catálogo. */
  precoUnitario?: number;
}

/**
 * Calcula preço (catálogo, no servidor), total e baixa de estoque de cada item.
 * Linhas repetidas do mesmo produto (inteiro + fracionado) são aplicadas em
 * sequência sobre o mesmo saldo — nenhuma baixa se perde. Deve rodar dentro
 * de `transacaoSerializavel`.
 */
export async function processarItensVenda(
  tx: Tx,
  itens: ItemEntrada[],
  opts: { precoLivre: boolean; descontarEstoque: boolean }
) {
  const ids = Array.from(new Set(itens.map((i) => i.produtoId)));
  const produtos = await tx.produto.findMany({ where: { id: { in: ids } } });
  const produtoMap = new Map(produtos.map((p) => [p.id, p]));
  const estado = new Map(
    produtos.map((p) => [p.id, { quantidade: String(p.quantidade), saldoFracionado: String(p.saldoFracionado) }])
  );

  const linhas = itens.map((item) => {
    const p = produtoMap.get(item.produtoId);
    if (!p) throw new Error("Produto não encontrado. Atualize a página e tente de novo.");
    if (!p.ativo || p.deletedAt) throw new Error(`O produto "${p.nome}" está desativado.`);

    const catalogo = precoDeCatalogo(
      {
        unidade: p.unidade,
        precoVenda: String(p.precoVenda),
        podeFracionar: p.podeFracionar,
        pesoUnidade: p.pesoUnidade ? String(p.pesoUnidade) : null,
        unidadeFracao: p.unidadeFracao,
        precoFracao: p.precoFracao ? String(p.precoFracao) : null,
      },
      item.unidadeVenda
    );
    const preco = opts.precoLivre && item.precoUnitario ? new Decimal(item.precoUnitario) : catalogo;
    const inteira = ehVendaInteira(p, item.unidadeVenda);

    let unidadesFechadasConsumidas = new Decimal(0);
    let saldoApos = new Decimal(estado.get(p.id)!.quantidade);
    if (opts.descontarEstoque) {
      const atual = estado.get(p.id)!;
      const r = calcularFracionamento(
        {
          podeFracionar: p.podeFracionar,
          pesoUnidade: p.pesoUnidade ? String(p.pesoUnidade) : null,
          ...atual,
        },
        item.quantidade,
        inteira
      );
      estado.set(p.id, {
        quantidade: r.novaQuantidade.toString(),
        saldoFracionado: r.novoSaldoFracionado.toString(),
      });
      unidadesFechadasConsumidas = r.unidadesFechadasConsumidas;
      saldoApos = r.novaQuantidade;
    }

    return {
      produtoId: p.id,
      nomeProduto: p.nome,
      unidadeVenda: item.unidadeVenda,
      quantidade: new Decimal(item.quantidade),
      precoUnitario: preco,
      total: totalItem(item.quantidade, preco),
      unidadesFechadasConsumidas,
      saldoApos,
    };
  });

  if (opts.descontarEstoque) {
    await Promise.all(
      ids.map((id) => {
        const e = estado.get(id)!;
        return tx.produto.update({
          where: { id },
          data: {
            quantidade: new Decimal(e.quantidade).toFixed(4),
            saldoFracionado: new Decimal(e.saldoFracionado).toFixed(4),
          },
        });
      })
    );
  }

  return linhas;
}
