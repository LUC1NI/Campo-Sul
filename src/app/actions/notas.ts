"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Unidade, MetodoPagamento, TipoDocumento } from "@prisma/client";
import { calcularFracionamento } from "@/lib/fracionamento";
import { Decimal } from "decimal.js";
import { proximoNumero } from "@/lib/numeracao-nf";
import { requireActiveUser, runAction, ActionResult } from "@/lib/auth-helpers";

const itemSchema = z.object({
  produtoId: z.string().cuid(),
  unidadeVenda: z.nativeEnum(Unidade),
  quantidade: z.number().positive(),
  precoUnitario: z.number().positive(),
});

const notaAvulsaSchema = z.object({
  itens: z.array(itemSchema).min(1, "Adicione ao menos 1 item").max(200),
  tipoDocumento: z.nativeEnum(TipoDocumento),
  metodoPagamento: z.nativeEnum(MetodoPagamento).default("DINHEIRO"),
  cpfCnpj: z.string().max(20).optional(),
  nomeCliente: z.string().max(200).optional(),
  observacao: z.string().max(500).optional(),
  descontarEstoque: z.boolean().default(true),
});

export type GerarNotaAvulsaInput = z.infer<typeof notaAvulsaSchema>;
export type GerarNotaAvulsaResultado = {
  vendaId: string;
  documentoId: string;
  tipoDocumento: TipoDocumento;
};

export async function gerarNotaAvulsa(
  input: GerarNotaAvulsaInput
): Promise<ActionResult<GerarNotaAvulsaResultado>> {
  return runAction("gerarNotaAvulsa", async () => {
    const user = await requireActiveUser();
    const data = notaAvulsaSchema.parse(input);

    const resultado = await prisma.$transaction(
      async (tx) => {
        const numeroVenda = await proximoNumero(
          tx as Parameters<typeof proximoNumero>[0],
          "VENDA"
        );

        // Busca todos os produtos de uma vez — elimina N+1
        const produtoIds = data.itens.map((i) => i.produtoId);
        const produtos = await tx.produto.findMany({ where: { id: { in: produtoIds } } });
        const produtoMap = new Map(produtos.map((p) => [p.id, p]));

        const itensCalculados = data.itens.map((item) => {
          const produto = produtoMap.get(item.produtoId);
          if (!produto) throw new Error(`Produto não encontrado`);

          let novaQuantidade: Decimal = new Decimal(String(produto.quantidade));
          let novoSaldoFracionado: Decimal = new Decimal(String(produto.saldoFracionado));
          let unidadesFechadasConsumidas: Decimal = new Decimal(0);

          if (data.descontarEstoque) {
            const calc = calcularFracionamento(
              {
                podeFracionar: produto.podeFracionar,
                pesoUnidade: produto.pesoUnidade ? String(produto.pesoUnidade) : null,
                quantidade: String(produto.quantidade),
                saldoFracionado: String(produto.saldoFracionado),
              },
              item.quantidade
            );
            novaQuantidade = calc.novaQuantidade;
            novoSaldoFracionado = calc.novoSaldoFracionado;
            unidadesFechadasConsumidas = calc.unidadesFechadasConsumidas;
          }

          return {
            item,
            produto,
            novaQuantidade,
            novoSaldoFracionado,
            unidadesFechadasConsumidas,
            totalItem: item.quantidade * item.precoUnitario,
          };
        });

        if (data.descontarEstoque) {
          await Promise.all(
            itensCalculados.map(({ item, novaQuantidade, novoSaldoFracionado }) =>
              tx.produto.update({
                where: { id: item.produtoId },
                data: {
                  quantidade: novaQuantidade.toFixed(4),
                  saldoFracionado: novoSaldoFracionado.toFixed(4),
                },
              })
            )
          );
        }

        const subtotal = itensCalculados.reduce((acc, i) => acc + i.totalItem, 0);

        const venda = await tx.venda.create({
          data: {
            numero: numeroVenda,
            subtotal: subtotal.toFixed(2),
            desconto: "0.00",
            total: subtotal.toFixed(2),
            observacao: data.observacao,
            descontouEstoque: data.descontarEstoque,
            usuarioId: user.id,
            itens: {
              create: itensCalculados.map(({ item, produto, totalItem, unidadesFechadasConsumidas }) => ({
                produtoId: item.produtoId,
                nomeProduto: produto.nome,
                unidadeVenda: item.unidadeVenda,
                quantidade: item.quantidade.toFixed(4),
                precoUnitario: item.precoUnitario.toFixed(4),
                desconto: "0.00",
                total: totalItem.toFixed(2),
                unidadesFechadasConsumidas: unidadesFechadasConsumidas.toFixed(4),
              })),
            },
            pagamentos: {
              create: [{ metodo: data.metodoPagamento, valor: subtotal.toFixed(2) }],
            },
          },
        });

        if (data.descontarEstoque) {
          await tx.movimentoEstoque.createMany({
            data: itensCalculados.map(({ item, novaQuantidade }) => ({
              produtoId: item.produtoId,
              tipo: "SAIDA_VENDA" as const,
              quantidade: `-${item.quantidade}`,
              saldoApos: novaQuantidade.toFixed(4),
              usuarioId: user.id,
              referenciaId: venda.id,
            })),
          });
        }

        const chaveCounter = data.tipoDocumento === "NOTA" ? "NOTA:1" : "RECIBO:1";
        const numeroDoc = await proximoNumero(
          tx as Parameters<typeof proximoNumero>[0],
          chaveCounter
        );

        const doc = await tx.documento.create({
          data: {
            tipo: data.tipoDocumento,
            numero: numeroDoc,
            vendaId: venda.id,
            cpfCnpj: data.cpfCnpj || null,
            nomeCliente: data.nomeCliente || null,
            emitidoPorId: user.id,
          },
        });

        return {
          vendaId: venda.id,
          documentoId: doc.id,
          tipoDocumento: data.tipoDocumento,
        };
      },
      { isolationLevel: "Serializable", timeout: 30000, maxWait: 10000 }
    );

    revalidatePath("/notas");
    revalidatePath("/estoque");
    return resultado;
  });
}
