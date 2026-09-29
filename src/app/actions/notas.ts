"use server";

import { transacaoSerializavel } from "@/lib/prisma";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { Unidade, MetodoPagamento, TipoDocumento } from "@prisma/client";
import { processarItensVenda } from "@/lib/itens-venda";
import { Decimal } from "decimal.js";
import { proximoNumero } from "@/lib/numeracao-nf";
import { requireActiveUser, runAction, ActionResult } from "@/lib/auth-helpers";

const itemSchema = z.object({
  produtoId: z.string().cuid(),
  unidadeVenda: z.nativeEnum(Unidade),
  quantidade: z.number().positive().max(100000),
  precoUnitario: z.number().positive().max(10_000_000),
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

    const resultado = await transacaoSerializavel(async (tx) => {
      // Preço livre só para admin; funcionário sempre usa o preço de catálogo.
      const linhas = await processarItensVenda(tx, data.itens, {
        precoLivre: user.role === "ADMIN",
        descontarEstoque: data.descontarEstoque,
      });
      const subtotal = linhas.reduce((acc, l) => acc.plus(l.total), new Decimal(0));

      const numeroVenda = await proximoNumero(tx, "VENDA");
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
            create: linhas.map((l) => ({
              produtoId: l.produtoId,
              nomeProduto: l.nomeProduto,
              unidadeVenda: l.unidadeVenda,
              quantidade: l.quantidade.toFixed(4),
              precoUnitario: l.precoUnitario.toFixed(4),
              desconto: "0.00",
              total: l.total.toFixed(2),
              unidadesFechadasConsumidas: l.unidadesFechadasConsumidas.toFixed(4),
            })),
          },
          pagamentos: {
            create: [{ metodo: data.metodoPagamento, valor: subtotal.toFixed(2) }],
          },
        },
      });

      if (data.descontarEstoque) {
        await tx.movimentoEstoque.createMany({
          data: linhas.map((l) => ({
            produtoId: l.produtoId,
            tipo: "SAIDA_VENDA" as const,
            quantidade: l.quantidade.negated().toFixed(4),
            saldoApos: l.saldoApos.toFixed(4),
            usuarioId: user.id,
            referenciaId: venda.id,
            observacao: `Nota avulsa — venda #${numeroVenda} (${l.unidadeVenda})`,
          })),
        });
      }

      const numeroDoc = await proximoNumero(
        tx,
        data.tipoDocumento === "NOTA" ? "NOTA:1" : "RECIBO:1"
      );
      const doc = await tx.documento.create({
        data: {
          tipo: data.tipoDocumento,
          numero: numeroDoc,
          vendaId: venda.id,
          cpfCnpj: data.cpfCnpj?.replace(/\D/g, "") || null,
          nomeCliente: data.nomeCliente?.trim() || null,
          emitidoPorId: user.id,
        },
      });

      return {
        vendaId: venda.id,
        documentoId: doc.id,
        tipoDocumento: data.tipoDocumento,
      };
    });

    revalidatePath("/notas");
    revalidatePath("/estoque");
    revalidateTag("dashboard");
    return resultado;
  });
}
