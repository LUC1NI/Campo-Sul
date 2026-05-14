"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Unidade, MetodoPagamento, TipoDocumento, StatusVenda } from "@prisma/client";
import { calcularFracionamento } from "@/lib/fracionamento";
import { proximoNumero } from "@/lib/numeracao-nf";

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
  itens: z.array(itemSchema).min(1, "Adicione ao menos 1 item"),
  pagamentos: z.array(pagamentoSchema).min(1, "Informe o pagamento"),
  desconto: z.number().min(0).default(0),
  observacao: z.string().optional(),
  tipoDocumento: z.nativeEnum(TipoDocumento).optional(),
  cpfCnpj: z.string().optional(),
  nomeCliente: z.string().optional(),
});

export type FinalizarVendaInput = z.infer<typeof vendaSchema>;

export async function finalizarVenda(input: FinalizarVendaInput) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Garante que o usuário da sessão ainda existe no banco (sessão JWT pode estar desatualizada)
  const usuarioAtivo = await prisma.usuario.findUnique({
    where: { id: session.user.id, ativo: true },
    select: { id: true },
  });
  if (!usuarioAtivo) redirect("/login");

  const data = vendaSchema.parse(input);

  // Verifica pagamento
  const subtotal = data.itens.reduce(
    (acc, item) => acc + item.quantidade * item.precoUnitario - item.desconto,
    0
  );
  const total = Math.max(0, subtotal - data.desconto);
  const totalPago = data.pagamentos.reduce((acc, p) => acc + p.valor, 0);
  const tolerancia = 0.02;

  if (totalPago < total - tolerancia) {
    throw new Error(`Pagamento insuficiente. Total: R$${total.toFixed(2)}, Pago: R$${totalPago.toFixed(2)}`);
  }

  const resultado = await prisma.$transaction(
    async (tx) => {
      const numeroVenda = await proximoNumero(tx as Parameters<typeof proximoNumero>[0], "VENDA");

      // Busca todos os produtos de uma vez para evitar N+1
      const produtoIds = data.itens.map((i) => i.produtoId);
      const produtos = await tx.produto.findMany({ where: { id: { in: produtoIds } } });
      const produtoMap = new Map(produtos.map((p) => [p.id, p]));

      // Processa estoque e cria itens
      const itensVenda = await Promise.all(
        data.itens.map(async (item) => {
          const produto = produtoMap.get(item.produtoId);
          if (!produto) throw new Error(`Produto ${item.produtoId} não encontrado`);

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

          const totalItem =
            item.quantidade * item.precoUnitario - item.desconto;

          return {
            produtoId: item.produtoId,
            nomeProduto: produto.nome,
            unidadeVenda: item.unidadeVenda,
            quantidade: item.quantidade.toFixed(4),
            precoUnitario: item.precoUnitario.toFixed(4),
            desconto: item.desconto.toFixed(2),
            total: Math.max(0, totalItem).toFixed(2),
            unidadesFechadasConsumidas: unidadesFechadasConsumidas.toFixed(4),
            movimentoData: {
              produtoId: item.produtoId,
              tipo: "SAIDA_VENDA" as const,
              quantidade: `-${item.quantidade}`,
              saldoApos: novaQuantidade.toFixed(4),
              usuarioId: session.user.id,
            },
          };
        })
      );

      const venda = await tx.venda.create({
        data: {
          numero: numeroVenda,
          subtotal: subtotal.toFixed(2),
          desconto: data.desconto.toFixed(2),
          total: total.toFixed(2),
          observacao: data.observacao,
          usuarioId: session.user.id,
          itens: {
            create: itensVenda.map(({ movimentoData: _, ...item }) => item),
          },
          pagamentos: {
            create: data.pagamentos.map((p) => ({
              metodo: p.metodo,
              valor: p.valor.toFixed(2),
            })),
          },
        },
      });

      // Movimentos de estoque
      await tx.movimentoEstoque.createMany({
        data: itensVenda.map((item) => ({
          ...item.movimentoData,
          referenciaId: venda.id,
        })),
      });

      // Documento
      let documentoId: string | null = null;
      if (data.tipoDocumento) {
        const chaveCounter =
          data.tipoDocumento === "NOTA" ? "NOTA:1" : "RECIBO:1";
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
        documentoId = doc.id;
      }

      return { vendaId: venda.id, numeroVenda, documentoId };
    },
    { isolationLevel: "Serializable", timeout: 30000, maxWait: 10000 }
  );

  return resultado;
}

const idSchema = z.string().cuid();
const motivoSchema = z.string().min(1).max(500);

export async function marcarErroPdf(documentoId: string, motivo: string) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const id = idSchema.parse(documentoId);
  const motivoSan = motivoSchema.parse(motivo).slice(0, 500);

  await prisma.documento.update({
    where: { id },
    data: { statusDoc: "ERRO_PDF", erroInfo: motivoSan },
  });
}

export async function marcarPdfOk(documentoId: string) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const id = idSchema.parse(documentoId);

  await prisma.documento.update({
    where: { id },
    data: { statusDoc: "EMITIDO", erroInfo: null },
  });
  revalidatePath("/notas");
}

export async function emitirNotaFiscal(documentoId: string): Promise<string> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") {
    throw new Error("Apenas administradores podem emitir Nota Fiscal.");
  }

  const id = idSchema.parse(documentoId);

  await prisma.$transaction(async (tx) => {
    const doc = await tx.documento.findUniqueOrThrow({ where: { id } });
    if (doc.tipo === "NOTA") throw new Error("Este documento já é uma Nota Fiscal.");
    const novoNumero = await proximoNumero(tx as Parameters<typeof proximoNumero>[0], "NOTA:1");
    await tx.documento.update({
      where: { id },
      data: {
        tipo: "NOTA",
        numero: novoNumero,
        statusDoc: "EMITIDO",
        erroInfo: null,
        reemitidoEm: new Date(),
        emitidoPorId: session.user.id,
      },
    });
  }, { isolationLevel: "Serializable" });

  revalidatePath("/notas");
  return id;
}

export async function cancelarVenda(vendaId: string) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") throw new Error("Sem permissão");

  const id = idSchema.parse(vendaId);

  await prisma.$transaction(
    async (tx) => {
      const venda = await tx.venda.findUnique({
        where: { id },
        include: { itens: true },
      });
      if (!venda) throw new Error("Venda não encontrada");
      if (venda.status === "CANCELADA") throw new Error("Venda já cancelada");

      const produtoIds = Array.from(new Set(venda.itens.map((i) => i.produtoId)));
      const produtos = await tx.produto.findMany({ where: { id: { in: produtoIds } } });
      const produtoMap = new Map(produtos.map((p) => [p.id, p]));

      if (venda.descontouEstoque) {
        for (const item of venda.itens) {
          const produto = produtoMap.get(item.produtoId);
          if (!produto) throw new Error(`Produto ${item.produtoId} não encontrado`);

          const novaQtd = Number(produto.quantidade) + Number(item.unidadesFechadasConsumidas);

          const pesoUnidade = produto.podeFracionar && produto.pesoUnidade
            ? Number(produto.pesoUnidade)
            : 0;
          const fracaoAcumulada = pesoUnidade > 0
            ? Number(item.quantidade) - Number(item.unidadesFechadasConsumidas) * pesoUnidade
            : 0;
          const novoSaldo = Math.max(0, Number(produto.saldoFracionado) - fracaoAcumulada);

          await tx.produto.update({
            where: { id: item.produtoId },
            data: {
              quantidade: novaQtd.toFixed(4),
              saldoFracionado: novoSaldo.toFixed(4),
            },
          });

          produto.quantidade = novaQtd.toFixed(4) as unknown as typeof produto.quantidade;
          produto.saldoFracionado = novoSaldo.toFixed(4) as unknown as typeof produto.saldoFracionado;
        }

        await tx.movimentoEstoque.createMany({
          data: venda.itens.map((item) => {
            const p = produtoMap.get(item.produtoId)!;
            return {
              produtoId: item.produtoId,
              tipo: "CANCELAMENTO_VENDA" as const,
              quantidade: String(item.quantidade),
              saldoApos: String(p.quantidade),
              referenciaId: id,
              observacao: `Cancelamento venda #${venda.numero}`,
              usuarioId: session.user.id,
            };
          }),
        });
      }

      await tx.venda.update({ where: { id }, data: { status: "CANCELADA" } });
    },
    { isolationLevel: "Serializable" }
  );

  revalidatePath("/vendas/historico");
}

type VendasFiltros = {
  periodo?: string;
  usuarioId?: string;
  metodo?: string;
  status?: string;
  q?: string;
};

export async function buscarVendas(pagina = 1, porPagina = 20, filtros: VendasFiltros = {}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

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

  const where = {
    ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
    ...(statusValido ? { status: filtros.status as StatusVenda } : {}),
    ...(filtros.usuarioId ? { usuarioId: filtros.usuarioId } : {}),
    ...(metodoValido ? { pagamentos: { some: { metodo: filtros.metodo as MetodoPagamento } } } : {}),
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
        documento: { select: { id: true, tipo: true, numero: true, statusDoc: true, erroInfo: true } },
        pagamentos: { select: { metodo: true, valor: true } },
      },
    }),
    prisma.venda.count({ where }),
  ]);

  return { vendas, total, paginas: Math.ceil(total / porPaginaSan), pagina: paginaSan, porPagina: porPaginaSan };
}
