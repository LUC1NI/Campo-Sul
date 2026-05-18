"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Unidade, MetodoPagamento, TipoDocumento, StatusVenda } from "@prisma/client";
import { calcularFracionamento } from "@/lib/fracionamento";
import { proximoNumero } from "@/lib/numeracao-nf";
import {
  requireActiveUser,
  requireAdmin,
  runAction,
  ActionResult,
  ActionPermissionError,
} from "@/lib/auth-helpers";

const itemSchema = z.object({
  produtoId: z.string().cuid(),
  unidadeVenda: z.nativeEnum(Unidade),
  quantidade: z.number().positive(),
  precoUnitario: z.number().positive(),
  desconto: z.number().min(0).default(0),
});

const pagamentoSchema = z.object({
  metodo: z.nativeEnum(MetodoPagamento),
  valor: z.number().positive(),
});

const vendaSchema = z.object({
  itens: z.array(itemSchema).min(1, "Adicione ao menos 1 item").max(200, "Limite de 200 itens"),
  pagamentos: z.array(pagamentoSchema).min(1, "Informe o pagamento").max(10),
  desconto: z.number().min(0).default(0),
  observacao: z.string().max(500).optional(),
  tipoDocumento: z.nativeEnum(TipoDocumento).optional(),
  cpfCnpj: z.string().max(20).optional(),
  nomeCliente: z.string().max(200).optional(),
});

export type FinalizarVendaInput = z.infer<typeof vendaSchema>;
export type FinalizarVendaResultado = {
  vendaId: string;
  numeroVenda: number;
  documentoId: string | null;
};

export async function finalizarVenda(
  input: FinalizarVendaInput
): Promise<ActionResult<FinalizarVendaResultado>> {
  return runAction("finalizarVenda", async () => {
    const user = await requireActiveUser();
    const data = vendaSchema.parse(input);

    const subtotal = data.itens.reduce(
      (acc, item) => acc + item.quantidade * item.precoUnitario - item.desconto,
      0
    );
    const total = Math.max(0, subtotal - data.desconto);
    const totalPago = data.pagamentos.reduce((acc, p) => acc + p.valor, 0);
    const tolerancia = 0.02;

    if (totalPago < total - tolerancia) {
      throw new Error(
        `Pagamento insuficiente. Total: R$${total.toFixed(2)}, Pago: R$${totalPago.toFixed(2)}`
      );
    }

    const resultado = await prisma.$transaction(
      async (tx) => {
        const numeroVenda = await proximoNumero(
          tx as Parameters<typeof proximoNumero>[0],
          "VENDA"
        );

        const produtoIds = data.itens.map((i) => i.produtoId);
        const produtos = await tx.produto.findMany({ where: { id: { in: produtoIds } } });
        const produtoMap = new Map(produtos.map((p) => [p.id, p]));

        const itensVenda = data.itens.map((item) => {
          const produto = produtoMap.get(item.produtoId);
          if (!produto) throw new Error(`Produto não encontrado`);

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

          const totalItem = item.quantidade * item.precoUnitario - item.desconto;

          return {
            item,
            produto,
            novaQuantidade,
            novoSaldoFracionado,
            unidadesFechadasConsumidas,
            totalItem: Math.max(0, totalItem),
          };
        });

        // Updates de produtos em paralelo (mesma transação)
        await Promise.all(
          itensVenda.map(({ item, novaQuantidade, novoSaldoFracionado }) =>
            tx.produto.update({
              where: { id: item.produtoId },
              data: {
                quantidade: novaQuantidade.toFixed(4),
                saldoFracionado: novoSaldoFracionado.toFixed(4),
              },
            })
          )
        );

        const venda = await tx.venda.create({
          data: {
            numero: numeroVenda,
            subtotal: subtotal.toFixed(2),
            desconto: data.desconto.toFixed(2),
            total: total.toFixed(2),
            observacao: data.observacao,
            usuarioId: user.id,
            itens: {
              create: itensVenda.map(({ item, produto, unidadesFechadasConsumidas, totalItem }) => ({
                produtoId: item.produtoId,
                nomeProduto: produto.nome,
                unidadeVenda: item.unidadeVenda,
                quantidade: item.quantidade.toFixed(4),
                precoUnitario: item.precoUnitario.toFixed(4),
                desconto: item.desconto.toFixed(2),
                total: totalItem.toFixed(2),
                unidadesFechadasConsumidas: unidadesFechadasConsumidas.toFixed(4),
              })),
            },
            pagamentos: {
              create: data.pagamentos.map((p) => ({
                metodo: p.metodo,
                valor: p.valor.toFixed(2),
              })),
            },
          },
        });

        await tx.movimentoEstoque.createMany({
          data: itensVenda.map(({ item, novaQuantidade }) => ({
            produtoId: item.produtoId,
            tipo: "SAIDA_VENDA" as const,
            quantidade: `-${item.quantidade}`,
            saldoApos: novaQuantidade.toFixed(4),
            usuarioId: user.id,
            referenciaId: venda.id,
          })),
        });

        let documentoId: string | null = null;
        if (data.tipoDocumento) {
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
          documentoId = doc.id;
        }

        return { vendaId: venda.id, numeroVenda, documentoId };
      },
      { isolationLevel: "Serializable", timeout: 30000, maxWait: 10000 }
    );

    return resultado;
  });
}

const idSchema = z.string().cuid();
const motivoSchema = z.string().min(1).max(500);

export async function marcarErroPdf(
  documentoId: string,
  motivo: string
): Promise<ActionResult> {
  return runAction("marcarErroPdf", async () => {
    await requireActiveUser();
    const id = idSchema.parse(documentoId);
    const motivoSan = motivoSchema.parse(motivo).slice(0, 500);

    await prisma.documento.update({
      where: { id },
      data: { statusDoc: "ERRO_PDF", erroInfo: motivoSan },
    });
  });
}

export async function marcarPdfOk(documentoId: string): Promise<ActionResult> {
  return runAction("marcarPdfOk", async () => {
    await requireActiveUser();
    const id = idSchema.parse(documentoId);

    await prisma.documento.update({
      where: { id },
      data: { statusDoc: "EMITIDO", erroInfo: null },
    });
    revalidatePath("/notas");
  });
}

export async function emitirNotaFiscal(
  documentoId: string
): Promise<ActionResult<{ id: string }>> {
  return runAction("emitirNotaFiscal", async () => {
    const user = await requireAdmin();
    const id = idSchema.parse(documentoId);

    await prisma.$transaction(
      async (tx) => {
        const doc = await tx.documento.findUniqueOrThrow({ where: { id } });
        if (doc.tipo === "NOTA") {
          throw new Error("Este documento já é uma Nota Fiscal.");
        }
        const novoNumero = await proximoNumero(
          tx as Parameters<typeof proximoNumero>[0],
          "NOTA:1"
        );
        await tx.documento.update({
          where: { id },
          data: {
            tipo: "NOTA",
            numero: novoNumero,
            statusDoc: "EMITIDO",
            erroInfo: null,
            reemitidoEm: new Date(),
            emitidoPorId: user.id,
          },
        });
      },
      { isolationLevel: "Serializable" }
    );

    revalidatePath("/notas");
    return { id };
  });
}

export async function cancelarVenda(vendaId: string): Promise<ActionResult> {
  return runAction("cancelarVenda", async () => {
    const user = await requireAdmin();
    const id = idSchema.parse(vendaId);

    await prisma.$transaction(
      async (tx) => {
        const venda = await tx.venda.findUnique({
          where: { id },
          include: { itens: true },
        });
        if (!venda) throw new Error("Venda não encontrada.");
        if (venda.status === "CANCELADA") throw new Error("Venda já foi cancelada.");

        if (venda.descontouEstoque && venda.itens.length > 0) {
          const produtoIds = Array.from(new Set(venda.itens.map((i) => i.produtoId)));
          const produtos = await tx.produto.findMany({ where: { id: { in: produtoIds } } });
          const produtoMap = new Map(produtos.map((p) => [p.id, p]));

          // Calcula novos saldos por produto agregando todos os itens da venda
          const ajustes = new Map<string, { quantidade: number; saldoFracionado: number }>();
          for (const item of venda.itens) {
            const produto = produtoMap.get(item.produtoId);
            if (!produto) continue;

            const atual = ajustes.get(item.produtoId) ?? {
              quantidade: Number(produto.quantidade),
              saldoFracionado: Number(produto.saldoFracionado),
            };

            const novaQtd = atual.quantidade + Number(item.unidadesFechadasConsumidas);
            const pesoUnidade =
              produto.podeFracionar && produto.pesoUnidade ? Number(produto.pesoUnidade) : 0;
            const fracaoAcumulada =
              pesoUnidade > 0
                ? Number(item.quantidade) -
                  Number(item.unidadesFechadasConsumidas) * pesoUnidade
                : 0;
            const novoSaldo = Math.max(0, atual.saldoFracionado - fracaoAcumulada);

            ajustes.set(item.produtoId, {
              quantidade: novaQtd,
              saldoFracionado: novoSaldo,
            });
          }

          // Aplica updates em paralelo
          await Promise.all(
            Array.from(ajustes.entries()).map(([produtoId, vals]) =>
              tx.produto.update({
                where: { id: produtoId },
                data: {
                  quantidade: vals.quantidade.toFixed(4),
                  saldoFracionado: vals.saldoFracionado.toFixed(4),
                },
              })
            )
          );

          await tx.movimentoEstoque.createMany({
            data: venda.itens.map((item) => {
              const ajuste = ajustes.get(item.produtoId)!;
              return {
                produtoId: item.produtoId,
                tipo: "CANCELAMENTO_VENDA" as const,
                quantidade: String(item.quantidade),
                saldoApos: ajuste.quantidade.toFixed(4),
                referenciaId: id,
                observacao: `Cancelamento venda #${venda.numero}`,
                usuarioId: user.id,
              };
            }),
          });
        }

        await tx.venda.update({ where: { id }, data: { status: "CANCELADA" } });
      },
      { isolationLevel: "Serializable", timeout: 30000, maxWait: 10000 }
    );

    revalidatePath("/vendas/historico");
  });
}

type VendasFiltros = {
  periodo?: string;
  usuarioId?: string;
  metodo?: string;
  status?: string;
  q?: string;
};

/**
 * Listagem de vendas com filtros + paginação.
 * Funcionário só vê as próprias vendas (S3 do audit).
 * Admin vê tudo.
 */
export async function buscarVendas(
  pagina = 1,
  porPagina = 20,
  filtros: VendasFiltros = {}
) {
  const user = await requireActiveUser();

  const paginaSan = Math.max(1, Math.floor(Number(pagina) || 1));
  const porPaginaSan = Math.min(100, Math.max(1, Math.floor(Number(porPagina) || 20)));

  let createdAtFilter: { gte?: Date; lt?: Date } | undefined;
  if (filtros.periodo && filtros.periodo !== "todos") {
    const now = new Date();
    const hoje = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (filtros.periodo === "hoje") {
      createdAtFilter = { gte: hoje, lt: new Date(hoje.getTime() + 86400000) };
    } else if (filtros.periodo === "7d") {
      createdAtFilter = { gte: new Date(hoje.getTime() - 6 * 86400000) };
    } else if (filtros.periodo === "30d") {
      createdAtFilter = { gte: new Date(hoje.getTime() - 29 * 86400000) };
    }
  }

  const numeroBusca = filtros.q ? parseInt(filtros.q.replace(/\D/g, "")) : NaN;
  const metodoValido = ["DINHEIRO", "DEBITO", "CREDITO", "PIX"].includes(filtros.metodo ?? "");
  const statusValido = filtros.status === "CONCLUIDA" || filtros.status === "CANCELADA";

  // Funcionário só vê as próprias vendas. Admin pode filtrar por outro vendedor.
  const usuarioIdFilter =
    user.role === "ADMIN" ? filtros.usuarioId : user.id;

  const where = {
    ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
    ...(statusValido ? { status: filtros.status as StatusVenda } : {}),
    ...(usuarioIdFilter ? { usuarioId: usuarioIdFilter } : {}),
    ...(metodoValido
      ? { pagamentos: { some: { metodo: filtros.metodo as MetodoPagamento } } }
      : {}),
    ...(!isNaN(numeroBusca) ? { numero: numeroBusca } : {}),
  };

  const [vendas, total] = await Promise.all([
    prisma.venda.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (paginaSan - 1) * porPaginaSan,
      take: porPaginaSan,
      select: {
        id: true,
        numero: true,
        status: true,
        total: true,
        createdAt: true,
        usuario: { select: { nome: true } },
        documento: {
          select: { id: true, tipo: true, numero: true, statusDoc: true, erroInfo: true },
        },
        pagamentos: { select: { metodo: true, valor: true } },
      },
    }),
    prisma.venda.count({ where }),
  ]);

  return {
    vendas,
    total,
    paginas: Math.ceil(total / porPaginaSan),
    pagina: paginaSan,
    porPagina: porPaginaSan,
    role: user.role,
  };
}

// Mantém compatibilidade com código antigo que checava throw
export { ActionPermissionError };
