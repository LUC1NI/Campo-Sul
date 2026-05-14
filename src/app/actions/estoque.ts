"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Unidade } from "@prisma/client";

// ---------------------------------------------------------------------------
// Parser do formato SIEG (exportação de estoque / SAT-CFe)
// Cada linha: [token0] [token1] [token2] [token3] [token4]
//   token0 = código+data(+quantidade se houver "-")
//   token1 = 14 zeros (ignorar)
//   token2 = campo de preço em 60 chars zero-padded; valor = int / 100000
//   token3 = EAN/GTIN (8 ou 13 dígitos)
//   token4 = zeros trailing (ignorar)
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
  // EAN-8, EAN-13 ou GTIN-14 (min 8, max 14 dígitos)
  if (!/^\d{8,14}$/.test(gtin)) return null;
  // Ignorar campos que são só zeros
  if (/^0+$/.test(gtin)) return null;

  // Preço: strip leading zeros, dividir por 100000
  const priceField = tokens[2] ?? "";
  const significativo = priceField.replace(/^0+/, "") || "0";
  const preco = significativo === "0" ? 0 : parseInt(significativo, 10) / 100000;
  if (preco <= 0) return null;

  // Quantidade: tenta extrair do token0 após o "-"
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
  preco: number;         // preço de custo extraído
  precoVenda: number;    // igual ao custo na preview (editável pelo usuário)
  produtoExistente: boolean;
  produtoNome?: string;
};

export type TxtPreview = {
  totalLinhas: number;
  totalUnicos: number;
  itens: ItemPreviewTxt[];
};

const MAX_TXT_BYTES = 10 * 1024 * 1024; // 10 MB

export async function parsearEstoqueTxt(
  content: string
): Promise<{ ok: true; data: TxtPreview } | { ok: false; erro: string }> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") return { ok: false, erro: "Sem permissão" };

  if (!content || content.length === 0) return { ok: false, erro: "Arquivo vazio" };
  if (Buffer.byteLength(content, "utf8") > MAX_TXT_BYTES) {
    return { ok: false, erro: "Arquivo muito grande (máx. 10 MB)" };
  }

  const linhas = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (linhas.length === 0) return { ok: false, erro: "Nenhuma linha encontrada" };

  // Agrupa por GTIN: soma quantidade, mantém último preço
  const mapa = new Map<string, { quantidadeTotal: number; preco: number; ocorrencias: number }>();

  for (const linha of linhas) {
    const parsed = parseLinha(linha);
    if (!parsed) continue;
    const existente = mapa.get(parsed.gtin);
    if (existente) {
      existente.quantidadeTotal += parsed.quantidade;
      existente.preco = parsed.preco; // último preço
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
    return { ok: false, erro: "Nenhum produto reconhecido no arquivo. Verifique o formato." };
  }

  // Verifica quais GTINs já existem no banco
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
    precoVenda: Number((dados.preco * 1.3).toFixed(2)), // sugestão: 30% markup
    produtoExistente: existentesMap.has(gtin),
    produtoNome: existentesMap.get(gtin),
  }));

  // Ordena: novos primeiro, depois existentes; por GTIN
  itens.sort((a, b) => {
    if (a.produtoExistente !== b.produtoExistente) return a.produtoExistente ? 1 : -1;
    return a.gtin.localeCompare(b.gtin);
  });

  return {
    ok: true,
    data: {
      totalLinhas: linhas.length,
      totalUnicos: mapa.size,
      itens,
    },
  };
}

const confirmarItemSchema = z.object({
  gtin: z.string().min(8).max(14),
  quantidade: z.number().min(0),
  preco: z.number().min(0),
  precoVenda: z.number().min(0.01),
  importar: z.boolean(),
});

const confirmarTxtSchema = z.object({
  itens: z.array(confirmarItemSchema).min(1),
});

export type ConfirmarImportacaoTxtInput = z.infer<typeof confirmarTxtSchema>;

export async function confirmarImportacaoTxt(
  input: ConfirmarImportacaoTxtInput
): Promise<{ ok: true; criados: number; atualizados: number } | { ok: false; erro: string }> {
  try {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") return { ok: false, erro: "Sem permissão" };

  const data = confirmarTxtSchema.parse(input);
  const itensImportar = data.itens.filter((i) => i.importar);
  if (itensImportar.length === 0) return { ok: false, erro: "Selecione ao menos 1 item para importar" };

  let criados = 0;
  let atualizados = 0;

  await prisma.$transaction(
    async (tx) => {
      for (const item of itensImportar) {
        const existente = await tx.produto.findFirst({
          where: { gtin: item.gtin, ativo: true },
        });

        if (existente) {
          // Só atualiza estoque e preço de custo
          const novaQtd = (Number(existente.quantidade) + item.quantidade).toFixed(4);
          await tx.produto.update({
            where: { id: existente.id },
            data: {
              quantidade: novaQtd,
              precoCusto: item.preco.toFixed(4),
            },
          });
          await tx.movimentoEstoque.create({
            data: {
              produtoId: existente.id,
              tipo: "ENTRADA_MANUAL",
              quantidade: item.quantidade.toFixed(4),
              saldoApos: novaQtd,
              precoCusto: item.preco.toFixed(4),
              observacao: "Importação SIEG TXT",
              usuarioId: session.user.id,
            },
          });
          atualizados++;
        } else {
          // Cria produto novo (nome = EAN temporário)
          const codigo = `SIEG-${item.gtin}`;
          const codigoExistente = await tx.produto.findFirst({ where: { codigo } });
          const codigoFinal = codigoExistente ? `SIEG-${item.gtin}-${Date.now()}` : codigo;

          const novo = await tx.produto.create({
            data: {
              codigo: codigoFinal,
              gtin: item.gtin,
              nome: item.gtin, // nome temporário — editar depois
              unidade: Unidade.UN,
              precoCusto: item.preco.toFixed(4),
              precoVenda: item.precoVenda.toFixed(4),
              quantidade: item.quantidade.toFixed(4),
            },
          });
          await tx.movimentoEstoque.create({
            data: {
              produtoId: novo.id,
              tipo: "ENTRADA_MANUAL",
              quantidade: item.quantidade.toFixed(4),
              saldoApos: item.quantidade.toFixed(4),
              precoCusto: item.preco.toFixed(4),
              observacao: "Importação SIEG TXT",
              usuarioId: session.user.id,
            },
          });
          criados++;
        }
      }
    },
    { isolationLevel: "Serializable" }
  );

  revalidatePath("/estoque");
  return { ok: true, criados, atualizados };
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : "Erro ao importar" };
  }
}
