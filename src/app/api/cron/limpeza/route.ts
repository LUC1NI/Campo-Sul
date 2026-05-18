import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { limparTentativasAntigas } from "@/lib/rate-limit";

// Vercel injeta automaticamente Authorization: Bearer <CRON_SECRET> nas chamadas de cron.
// Em invocações manuais, passe o mesmo header.
function autorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

function corteMeses(meses: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - meses);
  return d;
}

// Processa em lotes para não gerar um IN (…) gigante no Postgres
const LOTE = 500;

async function deletarEmLotes(ids: string[], fn: (batch: string[]) => Promise<number>): Promise<number> {
  let total = 0;
  for (let i = 0; i < ids.length; i += LOTE) {
    total += await fn(ids.slice(i, i + LOTE));
  }
  return total;
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) {
    return NextResponse.json({ ok: false, erro: "Unauthorized" }, { status: 401 });
  }

  const inicio = Date.now();
  const corte12 = corteMeses(12);
  const corte24 = corteMeses(24);

  const log: {
    movimentosEstoqueRemovidos: number;
    vendasCompactadas: number;
    itensVendaRemovidos: number;
    pagamentosRemovidos: number;
    loginAttemptsRemovidos: number;
    duracaoMs: number;
    executadoEm: string;
  } = {
    movimentosEstoqueRemovidos: 0,
    vendasCompactadas: 0,
    itensVendaRemovidos: 0,
    pagamentosRemovidos: 0,
    loginAttemptsRemovidos: 0,
    duracaoMs: 0,
    executadoEm: new Date().toISOString(),
  };

  try {
    // ── 1. Limpar MovimentoEstoque > 12 meses ────────────────────────────────
    // Seguro: saldos atuais ficam em Produto.quantidade, não são recalculados
    // dos movimentos. Movimentos são apenas log de auditoria.
    const { count: movimentos } = await prisma.movimentoEstoque.deleteMany({
      where: { createdAt: { lt: corte12 } },
    });
    log.movimentosEstoqueRemovidos = movimentos;

    // ── 2. Compactar Venda > 24 meses ────────────────────────────────────────
    // Mantém o registro da Venda (com total, subtotal, status).
    // Remove ItemVenda e Pagamento — ocupam a maior parte do espaço.
    // Documentos fiscais (Documento) ficam intactos via FK na Venda.
    // Filtra só vendas que ainda possuem itens (idempotente).
    const vendasAntigas = await prisma.venda.findMany({
      where: {
        createdAt: { lt: corte24 },
        itens: { some: {} },
      },
      select: { id: true },
    });

    const ids = vendasAntigas.map((v) => v.id);
    log.vendasCompactadas = ids.length;

    if (ids.length > 0) {
      log.itensVendaRemovidos = await deletarEmLotes(ids, async (lote) => {
        const { count } = await prisma.itemVenda.deleteMany({
          where: { vendaId: { in: lote } },
        });
        return count;
      });

      log.pagamentosRemovidos = await deletarEmLotes(ids, async (lote) => {
        const { count } = await prisma.pagamento.deleteMany({
          where: { vendaId: { in: lote } },
        });
        return count;
      });
    }

    // ── 3. Limpar LoginAttempt > 7 dias ──────────────────────────────────────
    log.loginAttemptsRemovidos = await limparTentativasAntigas();

    log.duracaoMs = Date.now() - inicio;

    return NextResponse.json({ ok: true, ...log });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        erro: err instanceof Error ? err.message : "Erro desconhecido",
        duracaoMs: Date.now() - inicio,
      },
      { status: 500 },
    );
  }
}
