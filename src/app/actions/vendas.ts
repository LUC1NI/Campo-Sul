"use server";

import { prisma, transacaoSerializavel } from "@/lib/prisma";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { Decimal } from "decimal.js";
import { Unidade, MetodoPagamento, TipoDocumento, StatusVenda } from "@prisma/client";
import { reverterFracionamento } from "@/lib/fracionamento";
import { proximoNumero } from "@/lib/numeracao-nf";
import { processarItensVenda } from "@/lib/itens-venda";
import { calcularTotais, ehVendaInteira } from "@/lib/venda-calculo";
import { inicioDoDiaSP } from "@/lib/format";
import {
  requireActiveUser,
  requireAdmin,
  runAction,
  ActionResult,
  ActionPermissionError,
  type SessionUser,
} from "@/lib/auth-helpers";

const itemSchema = z.object({
  produtoId: z.string().cuid(),
  unidadeVenda: z.nativeEnum(Unidade),
  quantidade: z.number().positive().max(100000),
  // Ignorado: o preço vem do catálogo no servidor (cliente não define preço).
  precoUnitario: z.number().optional(),
});

const pagamentoSchema = z.object({
  metodo: z.nativeEnum(MetodoPagamento),
  valor: z.number().positive().max(10_000_000),
});

const vendaSchema = z.object({
  itens: z.array(itemSchema).min(1, "Adicione ao menos 1 item").max(200, "Limite de 200 itens"),
  pagamentos: z.array(pagamentoSchema).min(1, "Informe o pagamento").max(10),
  desconto: z.number().min(0).max(10_000_000).default(0),
  observacao: z.string().max(500).optional(),
  tipoDocumento: z.nativeEnum(TipoDocumento).optional(),
  cpfCnpj: z.string().max(20).optional(),
  nomeCliente: z.string().max(200).optional(),
  // Gerada pelo carrinho: evita venda duplicada em duplo clique / resposta perdida.
  chaveIdempotencia: z.string().uuid().optional(),
});

export type FinalizarVendaInput = z.input<typeof vendaSchema>;
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

    if (data.chaveIdempotencia) {
      const existente = await vendaPorChave(data.chaveIdempotencia);
      if (existente) return existente;
    }

    try {
      return await criarVenda(user.id, data);
    } catch (err) {
      // Corrida com a mesma chave (duplo clique simultâneo): devolve a venda já criada.
      if (data.chaveIdempotencia && (err as { code?: string })?.code === "P2002") {
        const existente = await vendaPorChave(data.chaveIdempotencia);
        if (existente) return existente;
      }
      throw err;
    } finally {
      revalidateTag("dashboard");
    }
  });
}

async function vendaPorChave(chave: string): Promise<FinalizarVendaResultado | null> {
  const v = await prisma.venda.findUnique({
    where: { chaveIdempotencia: chave },
    select: { id: true, numero: true, documento: { select: { id: true } } },
  });
  return v ? { vendaId: v.id, numeroVenda: v.numero, documentoId: v.documento?.id ?? null } : null;
}

function criarVenda(
  usuarioId: string,
  data: z.output<typeof vendaSchema>
): Promise<FinalizarVendaResultado> {
  return transacaoSerializavel(async (tx) => {
    const linhas = await processarItensVenda(tx, data.itens, {
      precoLivre: false,
      descontarEstoque: true,
    });
    const totais = calcularTotais(
      linhas.map((l) => l.total),
      data.desconto,
      data.pagamentos
    );

    const numeroVenda = await proximoNumero(tx, "VENDA");
    const venda = await tx.venda.create({
      data: {
        numero: numeroVenda,
        chaveIdempotencia: data.chaveIdempotencia,
        subtotal: totais.subtotal.toFixed(2),
        desconto: totais.desconto.toFixed(2),
        total: totais.total.toFixed(2),
        observacao: data.observacao,
        usuarioId,
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
          create: totais.pagamentos.map((p) => ({ metodo: p.metodo, valor: p.valor.toFixed(2) })),
        },
      },
    });

    await tx.movimentoEstoque.createMany({
      data: linhas.map((l) => ({
        produtoId: l.produtoId,
        tipo: "SAIDA_VENDA" as const,
        quantidade: l.quantidade.negated().toFixed(4),
        saldoApos: l.saldoApos.toFixed(4),
        usuarioId,
        referenciaId: venda.id,
        observacao: `Venda #${numeroVenda} (${l.unidadeVenda})`,
      })),
    });

    let documentoId: string | null = null;
    if (data.tipoDocumento) {
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
          emitidoPorId: usuarioId,
        },
      });
      documentoId = doc.id;
    }

    return { vendaId: venda.id, numeroVenda, documentoId };
  });
}

const idSchema = z.string().cuid();
const motivoSchema = z.string().min(1).max(500);

/** Funcionário só mexe em documentos das próprias vendas; admin em todos. */
function filtroDono(user: SessionUser) {
  return user.role === "ADMIN" ? {} : { venda: { usuarioId: user.id } };
}

export async function marcarErroPdf(
  documentoId: string,
  motivo: string
): Promise<ActionResult> {
  return runAction("marcarErroPdf", async () => {
    const user = await requireActiveUser();
    const id = idSchema.parse(documentoId);
    const motivoSan = motivoSchema.parse(motivo);

    await prisma.documento.updateMany({
      where: { id, ...filtroDono(user) },
      data: { statusDoc: "ERRO_PDF", erroInfo: motivoSan },
    });
  });
}

export async function marcarPdfOk(documentoId: string): Promise<ActionResult> {
  return runAction("marcarPdfOk", async () => {
    const user = await requireActiveUser();
    const id = idSchema.parse(documentoId);

    await prisma.documento.updateMany({
      where: { id, ...filtroDono(user) },
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

    await transacaoSerializavel(async (tx) => {
      const doc = await tx.documento.findUniqueOrThrow({ where: { id } });
      if (doc.tipo === "NOTA") {
        throw new Error("Este documento já é uma nota.");
      }
      // Número de recibo antigo fica "pulado" — aceitável: documento não é fiscal.
      const novoNumero = await proximoNumero(tx, "NOTA:1");
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
    });

    revalidatePath("/notas");
    return { id };
  });
}

export async function cancelarVenda(vendaId: string): Promise<ActionResult> {
  return runAction("cancelarVenda", async () => {
    const user = await requireAdmin();
    const id = idSchema.parse(vendaId);

    await transacaoSerializavel(async (tx) => {
      const venda = await tx.venda.findUnique({
        where: { id },
        include: { itens: true },
      });
      if (!venda) throw new Error("Venda não encontrada.");
      if (venda.status === "CANCELADA") throw new Error("Esta venda já foi cancelada.");

      if (venda.descontouEstoque && venda.itens.length > 0) {
        const produtoIds = Array.from(new Set(venda.itens.map((i) => i.produtoId)));
        const produtos = await tx.produto.findMany({ where: { id: { in: produtoIds } } });
        const produtoMap = new Map(produtos.map((p) => [p.id, p]));

        // Estado corrente por produto: itens repetidos são revertidos em sequência.
        const estado = new Map(
          produtos.map((p) => [
            p.id,
            { quantidade: String(p.quantidade), saldoFracionado: String(p.saldoFracionado) },
          ])
        );
        const saldosApos: string[] = [];
        for (const item of venda.itens) {
          const produto = produtoMap.get(item.produtoId)!;
          const r = reverterFracionamento(
            {
              podeFracionar: produto.podeFracionar,
              pesoUnidade: produto.pesoUnidade ? String(produto.pesoUnidade) : null,
              ...estado.get(item.produtoId)!,
            },
            {
              quantidade: String(item.quantidade),
              unidadesFechadasConsumidas: String(item.unidadesFechadasConsumidas),
              vendaInteira: ehVendaInteira(produto, item.unidadeVenda),
            }
          );
          estado.set(item.produtoId, {
            quantidade: r.novaQuantidade.toString(),
            saldoFracionado: r.novoSaldoFracionado.toString(),
          });
          saldosApos.push(r.novaQuantidade.toFixed(4));
        }

        await Promise.all(
          produtoIds.map((pid) => {
            const e = estado.get(pid)!;
            return tx.produto.update({
              where: { id: pid },
              data: {
                quantidade: new Decimal(e.quantidade).toFixed(4),
                saldoFracionado: new Decimal(e.saldoFracionado).toFixed(4),
              },
            });
          })
        );

        await tx.movimentoEstoque.createMany({
          data: venda.itens.map((item, i) => ({
            produtoId: item.produtoId,
            tipo: "CANCELAMENTO_VENDA" as const,
            quantidade: String(item.quantidade),
            saldoApos: saldosApos[i],
            referenciaId: id,
            observacao: `Cancelamento venda #${venda.numero} (${item.unidadeVenda})`,
            usuarioId: user.id,
          })),
        });
      }

      // updateMany com status no where: segundo cancelamento simultâneo não passa.
      const { count } = await tx.venda.updateMany({
        where: { id, status: "CONCLUIDA" },
        data: { status: "CANCELADA" },
      });
      if (count !== 1) throw new Error("Esta venda já foi cancelada.");
    });

    revalidatePath("/vendas/historico");
    revalidateTag("dashboard");
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
    if (filtros.periodo === "hoje") {
      createdAtFilter = { gte: inicioDoDiaSP(), lt: inicioDoDiaSP(new Date(), 1) };
    } else if (filtros.periodo === "7d") {
      createdAtFilter = { gte: inicioDoDiaSP(new Date(), -6) };
    } else if (filtros.periodo === "30d") {
      createdAtFilter = { gte: inicioDoDiaSP(new Date(), -29) };
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
