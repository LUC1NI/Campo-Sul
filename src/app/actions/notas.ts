"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Unidade, MetodoPagamento, TipoDocumento } from "@prisma/client";
import { calcularFracionamento } from "@/lib/fracionamento";
import { proximoNumero } from "@/lib/numeracao-nf";

const itemSchema = z.object({
  produtoId: z.string().cuid(),
  unidadeVenda: z.nativeEnum(Unidade),
  quantidade: z.number().positive(),
  precoUnitario: z.number().positive(),
});

const notaAvulsaSchema = z.object({
  itens: z.array(itemSchema).min(1, "Adicione ao menos 1 item"),
  tipoDocumento: z.nativeEnum(TipoDocumento),
  metodoPagamento: z.nativeEnum(MetodoPagamento).default("DINHEIRO"),
  cpfCnpj: z.string().optional(),
  nomeCliente: z.string().optional(),
  observacao: z.string().optional(),
  descontarEstoque: z.boolean().default(true),
});

export type GerarNotaAvulsaInput = z.infer<typeof notaAvulsaSchema>;

export async function gerarNotaAvulsa(input: GerarNotaAvulsaInput) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const data = notaAvulsaSchema.parse(input);

  const resultado = await prisma.$transaction(
    async (tx) => {
      const numeroVenda = await proximoNumero(tx as Parameters<typeof proximoNumero>[0], "VENDA");

      const itensVenda = await Promise.all(
        data.itens.map(async (item) => {
          const produto = await tx.produto.findUnique({ where: { id: item.produtoId } });
          if (!produto) throw new Error(`Produto ${item.produtoId} não encontrado`);

          let movimentoData: {
            produtoId: string;
            tipo: "SAIDA_VENDA";
            quantidade: string;
            saldoApos: string;
            usuarioId: string;
          } | null = null;

          if (data.descontarEstoque) {
            const { novaQuantidade, novoSaldoFracionado, unidadesFechadasConsumidas } =
              calcularFracionamento(
                {
                  podeFracionar: produto.podeFracionar,
                  pesoUnidade: produto.pesoUnidade ? String(produto.pesoUnidade) : null,
                  quantidade: String(produto.quantidade),
                  saldoFracionado: String(produto.saldoFracionado),
                },
                item.quantidade
              );

            await tx.produto.update({
              where: { id: item.produtoId },
              data: {
                quantidade: novaQuantidade.toFixed(4),
                saldoFracionado: novoSaldoFracionado.toFixed(4),
              },
            });

            movimentoData = {
              produtoId: item.produtoId,
              tipo: "SAIDA_VENDA",
              quantidade: `-${item.quantidade}`,
              saldoApos: novaQuantidade.toFixed(4),
              usuarioId: session.user.id,
            };

            return {
              produtoId: item.produtoId,
              nomeProduto: produto.nome,
              unidadeVenda: item.unidadeVenda,
              quantidade: item.quantidade.toFixed(4),
              precoUnitario: item.precoUnitario.toFixed(4),
              desconto: "0.00",
              total: (item.quantidade * item.precoUnitario).toFixed(2),
              unidadesFechadasConsumidas: unidadesFechadasConsumidas.toFixed(4),
              movimentoData,
            };
          }

          return {
            produtoId: item.produtoId,
            nomeProduto: produto.nome,
            unidadeVenda: item.unidadeVenda,
            quantidade: item.quantidade.toFixed(4),
            precoUnitario: item.precoUnitario.toFixed(4),
            desconto: "0.00",
            total: (item.quantidade * item.precoUnitario).toFixed(2),
            unidadesFechadasConsumidas: "0.0000",
            movimentoData: null,
          };
        })
      );

      const subtotal = itensVenda.reduce((acc, i) => acc + Number(i.total), 0);

      const venda = await tx.venda.create({
        data: {
          numero: numeroVenda,
          subtotal: subtotal.toFixed(2),
          desconto: "0.00",
          total: subtotal.toFixed(2),
          observacao: data.observacao,
          descontouEstoque: data.descontarEstoque,
          usuarioId: session.user.id,
          itens: {
            create: itensVenda.map(({ movimentoData: _, ...item }) => item),
          },
          pagamentos: {
            create: [{ metodo: data.metodoPagamento, valor: subtotal.toFixed(2) }],
          },
        },
      });

      if (data.descontarEstoque) {
        const movimentos = itensVenda
          .filter((i) => i.movimentoData !== null)
          .map((i) => ({ ...i.movimentoData!, referenciaId: venda.id }));
        if (movimentos.length > 0) {
          await tx.movimentoEstoque.createMany({ data: movimentos });
        }
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
          emitidoPorId: session.user.id,
        },
      });

      return { vendaId: venda.id, documentoId: doc.id, tipoDocumento: data.tipoDocumento };
    },
    { isolationLevel: "Serializable" }
  );

  revalidatePath("/notas");
  revalidatePath("/estoque");
  return resultado;
}
