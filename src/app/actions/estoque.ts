"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Unidade } from "@prisma/client";
import { requireAdmin, runAction } from "@/lib/auth-helpers";

// ---------------------------------------------------------------------------
// Parser do formato SIEG (exportação de estoque / SAT-CFe)
// ---------------------------------------------------------------------------

type LinhaParseada = {
  gtin: string;
  quantidade: number;
  preco: number;
};

function parseLinha(linha: string): LinhaParseada | null {
  const tokens = linha.trim().split(/\s+/);
  if (tokens.length < 4) return null;

  const gtin = tokens[3];
  if (!/^\d{8,14}$/.test(gtin)) return null;
  if (/^0+$/.test(gtin)) return null;

  const priceField = tokens[2] ?? "";
  const significativo = priceField.replace(/^0+/, "") || "0";
  const preco = significativo === "0" ? 0 : parseInt(significativo, 10) / 100000;
  if (preco <= 0) return null;

  let quantidade = 1;
  const t0 = tokens[0] ?? "";
  const dashIdx = t0.indexOf("-");
  if (dashIdx !== -1) {
    const afterDash = t0.substring(dashIdx + 1);
    const qtyStr = afterDash.substring(0, 9);
    const q = parseInt(qtyStr, 10);
    if (q > 0) quantidade = q;
  }

  return { gtin, quantidade, preco };
}

export type ItemPreviewTxt = {
  gtin: string;
  quantidade: number;
  preco: number;
  precoVenda: number;
  produtoExistente: boolean;
  produtoNome?: string;
};

export type TxtPreview = {
  totalLinhas: number;
  totalUnicos: number;
  itens: ItemPreviewTxt[];
};

const MAX_TXT_BYTES = 10 * 1024 * 1024;

export async function parsearEstoqueTxt(
  content: string
): Promise<{ ok: true; data: TxtPreview } | { ok: false; erro: string }> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, erro: "Sem permissão" };
  }

  if (!content || content.length === 0) return { ok: false, erro: "Arquivo vazio" };
  if (Buffer.byteLength(content, "utf8") > MAX_TXT_BYTES) {
    return { ok: false, erro: "Arquivo muito grande (máx. 10 MB)" };
  }

  const linhas = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (linhas.length === 0) return { ok: false, erro: "Nenhuma linha encontrada" };

  const mapa = new Map<string, { quantidadeTotal: number; preco: number; ocorrencias: number }>();

  for (const linha of linhas) {
    const parsed = parseLinha(linha);
    if (!parsed) continue;
    const existente = mapa.get(parsed.gtin);
    if (existente) {
      existente.quantidadeTotal += parsed.quantidade;
      existente.preco = parsed.preco;
      existente.ocorrencias += 1;
    } else {
      mapa.set(parsed.gtin, {
        quantidadeTotal: parsed.quantidade,
        preco: parsed.preco,
        ocorrencias: 1,
      });
    }
  }

  if (mapa.size === 0) {
    return {
      ok: false,
      erro: "Nenhum produto reconhecido no arquivo. Verifique o formato.",
    };
  }

  const gtins = Array.from(mapa.keys());
  const existentes = await prisma.produto.findMany({
    where: { gtin: { in: gtins }, ativo: true },
    select: { gtin: true, nome: true },
  });
  const existentesMap = new Map(existentes.map((p) => [p.gtin!, p.nome]));

  const itens: ItemPreviewTxt[] = Array.from(mapa.entries()).map(([gtin, dados]) => ({
    gtin,
    quantidade: dados.quantidadeTotal,
    preco: Number(dados.preco.toFixed(2)),
    precoVenda: Number((dados.preco * 1.3).toFixed(2)),
    produtoExistente: existentesMap.has(gtin),
    produtoNome: existentesMap.get(gtin),
  }));

  itens.sort((a, b) => {
    if (a.produtoExistente !== b.produtoExistente) return a.produtoExistente ? 1 : -1;
    return a.gtin.localeCompare(b.gtin);
  });

  return { ok: true, data: { totalLinhas: linhas.length, totalUnicos: mapa.size, itens } };
}

const confirmarItemSchema = z.object({
  gtin: z.string().min(8).max(14),
  quantidade: z.number().min(0).max(1_000_000),
  preco: z.number().min(0).max(1_000_000),
  precoVenda: z.number().min(0.01).max(1_000_000),
  importar: z.boolean(),
});

const confirmarTxtSchema = z.object({
  itens: z.array(confirmarItemSchema).min(1).max(5000),
});

export type ConfirmarImportacaoTxtInput = z.infer<typeof confirmarTxtSchema>;

export async function confirmarImportacaoTxt(
  input: ConfirmarImportacaoTxtInput
): Promise<{ ok: true; criados: number; atualizados: number } | { ok: false; erro: string }> {
  const r = await runAction("confirmarImportacaoTxt", async () => {
    const user = await requireAdmin();
    const data = confirmarTxtSchema.parse(input);

    const itensImportar = data.itens.filter((i) => i.importar);
    if (itensImportar.length === 0) {
      throw new Error("Selecione ao menos 1 item para importar.");
    }

    const gtins = itensImportar.map((i) => i.gtin);

    // Busca todos os produtos existentes de uma vez
    const existentes = await prisma.produto.findMany({
      where: { gtin: { in: gtins }, ativo: true },
      select: { id: true, gtin: true, quantidade: true },
    });
    const existentePorGtin = new Map(existentes.map((e) => [e.gtin!, e]));

    const { criados, atualizados } = await prisma.$transaction(
      async (tx) => {
        let criadosCount = 0;
        let atualizadosCount = 0;

        // --- 1. Itens existentes: agregar updates por produto ---
        const updates: Array<{
          produtoId: string;
          gtin: string;
          quantidade: number;
          preco: number;
          novaQtd: number;
        }> = [];

        // --- 2. Itens novos: criar (precisamos do ID) ---
        const novosParaCriar: typeof itensImportar = [];

        for (const item of itensImportar) {
          const ex = existentePorGtin.get(item.gtin);
          if (ex) {
            const novaQtd = Number(ex.quantidade) + item.quantidade;
            updates.push({
              produtoId: ex.id,
              gtin: item.gtin,
              quantidade: item.quantidade,
              preco: item.preco,
              novaQtd,
            });
            atualizadosCount++;
          } else {
            novosParaCriar.push(item);
            criadosCount++;
          }
        }

        // Aplica updates em paralelo
        await Promise.all(
          updates.map((u) =>
            tx.produto.update({
              where: { id: u.produtoId },
              data: {
                quantidade: u.novaQtd.toFixed(4),
                precoCusto: u.preco.toFixed(4),
              },
            })
          )
        );

        // Cria os novos em paralelo (precisa do ID retornado)
        const novosCriadosPorGtin = new Map<
          string,
          { id: string; quantidade: number; preco: number }
        >();
        await Promise.all(
          novosParaCriar.map(async (item) => {
            const codigo = `SIEG-${item.gtin}`;
            const codigoExistente = await tx.produto.findFirst({
              where: { codigo },
              select: { id: true },
            });
            const codigoFinal = codigoExistente ? `SIEG-${item.gtin}-${Date.now()}` : codigo;

            const novo = await tx.produto.create({
              data: {
                codigo: codigoFinal,
                gtin: item.gtin,
                nome: item.gtin,
                unidade: Unidade.UN,
                precoCusto: item.preco.toFixed(4),
                precoVenda: item.precoVenda.toFixed(4),
                quantidade: item.quantidade.toFixed(4),
              },
              select: { id: true },
            });
            novosCriadosPorGtin.set(item.gtin, {
              id: novo.id,
              quantidade: item.quantidade,
              preco: item.preco,
            });
          })
        );

        // --- 3. Movimentos em createMany (UMA query) ---
        const movimentos = [
          ...updates.map((u) => ({
            produtoId: u.produtoId,
            tipo: "ENTRADA_MANUAL" as const,
            quantidade: u.quantidade.toFixed(4),
            saldoApos: u.novaQtd.toFixed(4),
            precoCusto: u.preco.toFixed(4),
            observacao: "Importação SIEG TXT",
            usuarioId: user.id,
          })),
          ...Array.from(novosCriadosPorGtin.entries()).map(([, v]) => ({
            produtoId: v.id,
            tipo: "ENTRADA_MANUAL" as const,
            quantidade: v.quantidade.toFixed(4),
            saldoApos: v.quantidade.toFixed(4),
            precoCusto: v.preco.toFixed(4),
            observacao: "Importação SIEG TXT",
            usuarioId: user.id,
          })),
        ];

        if (movimentos.length > 0) {
          await tx.movimentoEstoque.createMany({ data: movimentos });
        }

        return { criados: criadosCount, atualizados: atualizadosCount };
      },
      { isolationLevel: "Serializable", timeout: 30000, maxWait: 10000 }
    );

    revalidatePath("/estoque");
    return { criados, atualizados };
  });

  if (r.ok) return { ok: true, criados: r.data.criados, atualizados: r.data.atualizados };
  return { ok: false, erro: r.erro };
}
