"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Unidade } from "@prisma/client";
import { parseNfeXml } from "@/lib/nfe-xml-parser";
import {
  requireActiveUser,
  requireAdmin,
  runAction,
} from "@/lib/auth-helpers";

function mapUnidade(uCom: string): Unidade {
  const u = uCom.toUpperCase().trim();
  if (["KG", "GR", "G", "GRAMA", "GRAMAS"].includes(u)) return "KG";
  if (["L", "LT", "LTR", "ML", "LITRO", "LITROS"].includes(u)) return "L";
  if (["SC", "SAC", "SACO", "SACOS"].includes(u)) return "SACO";
  if (["CX", "CX.", "CAIXA", "CAIXAS"].includes(u)) return "CX";
  if (["M", "MT", "METRO", "METROS"].includes(u)) return "M";
  return "UN";
}

export interface ItemPreview {
  gtin: string | null;
  descricao: string;
  unidadeNfe: string;
  quantidade: string;
  valorUnitario: string;
  valorTotal: string;
  produtoId: string | null;
  produtoNome: string | null;
  unidadeMapeada: Unidade;
}

export interface XmlPreview {
  chaveAcesso: string;
  numeroNf: string;
  cnpjEmitente: string;
  nomeEmitente: string;
  valorTotal: string;
  jaImportada: boolean;
  itens: ItemPreview[];
}

const MAX_XML_BYTES = 5 * 1024 * 1024; // 5 MB

export async function parsearXml(
  xmlContent: string
): Promise<{ ok: true; data: XmlPreview } | { ok: false; erro: string }> {
  await requireActiveUser();

  if (typeof xmlContent !== "string" || xmlContent.length === 0) {
    return { ok: false, erro: "XML vazio" };
  }
  if (Buffer.byteLength(xmlContent, "utf8") > MAX_XML_BYTES) {
    return { ok: false, erro: "Arquivo XML muito grande (máx. 5 MB)" };
  }

  try {
    const parsed = parseNfeXml(xmlContent);

    const existente = await prisma.entradaXml.findUnique({
      where: { chaveAcesso: parsed.chaveAcesso },
      select: { id: true },
    });

    // Match em UMA query — pega todos os produtos com GTIN listado de uma vez
    const gtinsValidos = parsed.itens
      .map((i) => i.gtin)
      .filter((g): g is string => g !== null && g.length > 0);

    const matches = gtinsValidos.length
      ? await prisma.produto.findMany({
          where: { gtin: { in: gtinsValidos }, ativo: true },
          select: { id: true, nome: true, gtin: true },
        })
      : [];
    const matchMap = new Map(matches.map((p) => [p.gtin!, p]));

    const itens: ItemPreview[] = parsed.itens.map((item) => {
      const match = item.gtin ? matchMap.get(item.gtin) : null;
      return {
        gtin: item.gtin,
        descricao: item.descricao,
        unidadeNfe: item.unidadeComercial,
        quantidade: item.quantidade,
        valorUnitario: item.valorUnitario,
        valorTotal: item.valorTotal,
        produtoId: match?.id ?? null,
        produtoNome: match?.nome ?? null,
        unidadeMapeada: mapUnidade(item.unidadeComercial),
      };
    });

    return {
      ok: true,
      data: {
        chaveAcesso: parsed.chaveAcesso,
        numeroNf: parsed.numeroNf,
        cnpjEmitente: parsed.cnpjEmitente,
        nomeEmitente: parsed.nomeEmitente,
        valorTotal: parsed.valorTotal,
        jaImportada: !!existente,
        itens,
      },
    };
  } catch (err) {
    console.error("[xml] parseError", err);
    return {
      ok: false,
      erro: err instanceof Error ? err.message.slice(0, 200) : "Erro ao processar XML",
    };
  }
}

const itemConfirmSchema = z.object({
  gtin: z.string().nullable(),
  descricao: z.string().min(1).max(300),
  unidadeNfe: z.string().max(20),
  quantidade: z.string(),
  valorUnitario: z.string(),
  valorTotal: z.string(),
  produtoId: z.string().nullable(),
  unidadeMapeada: z.nativeEnum(Unidade),
  precoVenda: z.string().optional(),
  categoriaId: z.string().nullable().optional(),
});

const confirmarSchema = z.object({
  chaveAcesso: z.string().min(40).max(48),
  numeroNf: z.string().max(20),
  cnpjEmitente: z.string().max(20),
  nomeEmitente: z.string().max(200),
  valorTotal: z.string().max(20),
  xmlOriginal: z.string().max(MAX_XML_BYTES),
  itens: z.array(itemConfirmSchema).min(1).max(500),
});

export type ConfirmarImportacaoInput = z.infer<typeof confirmarSchema>;

export async function confirmarImportacaoXml(
  input: ConfirmarImportacaoInput
): Promise<{ ok: true; novos: number; atualizados: number } | { ok: false; erro: string }> {
  const r = await runAction("confirmarImportacaoXml", async () => {
    const user = await requireAdmin();
    const data = confirmarSchema.parse(input);

    const existente = await prisma.entradaXml.findUnique({
      where: { chaveAcesso: data.chaveAcesso },
      select: { id: true },
    });
    if (existente) throw new Error("Esta NF-e já foi importada anteriormente.");

    const { novos, atualizados } = await prisma.$transaction(
      async (tx) => {
        const entrada = await tx.entradaXml.create({
          data: {
            chaveAcesso: data.chaveAcesso,
            numeroNf: data.numeroNf,
            cnpjEmitente: data.cnpjEmitente,
            nomeEmitente: data.nomeEmitente,
            valorTotal: data.valorTotal,
            xmlOriginal: data.xmlOriginal,
            importadoPorId: user.id,
          },
        });

        // --- 1. Criação em lote dos produtos novos ---
        // O Prisma createMany não retorna IDs, então criamos um a um (mas em
        // paralelo — não bloqueia entre si). Para preço unitário/categoria
        // diferentes por item, esta é a forma correta.
        const novosItens = data.itens
          .map((item, idx) => ({ item, idx }))
          .filter(({ item }) => !item.produtoId);

        const idsNovos = await Promise.all(
          novosItens.map(async ({ item, idx }) => {
            const codigo = `IMP-${data.chaveAcesso.slice(-8)}-${String(idx + 1).padStart(3, "0")}`;
            const precoVenda = item.precoVenda ?? item.valorUnitario;
            const criado = await tx.produto.create({
              data: {
                codigo,
                gtin: item.gtin ?? null,
                nome: item.descricao.slice(0, 200),
                unidade: item.unidadeMapeada,
                precoCusto: item.valorUnitario,
                precoVenda,
                categoriaId: item.categoriaId ?? null,
                quantidade: "0",
              },
              select: { id: true },
            });
            return { idx, produtoId: criado.id };
          })
        );
        const novoIdPorIdx = new Map(idsNovos.map((x) => [x.idx, x.produtoId]));

        // --- 2. Resolve produtoId final + busca estoque atual de TODOS de uma vez ---
        const itensComProduto = data.itens.map((item, idx) => ({
          ...item,
          produtoId: item.produtoId ?? novoIdPorIdx.get(idx)!,
          criouProduto: !item.produtoId,
        }));

        const produtoIdsTodos = itensComProduto.map((i) => i.produtoId);
        const produtosAtuais = await tx.produto.findMany({
          where: { id: { in: produtoIdsTodos } },
          select: { id: true, quantidade: true },
        });
        const qtdAtualPorId = new Map(
          produtosAtuais.map((p) => [p.id, Number(p.quantidade)])
        );

        // --- 3. Calcula novas quantidades agregadas (caso o mesmo produto
        //     apareça em vários itens da NF-e, soma todas) ---
        const ajustePorProduto = new Map<string, number>();
        for (const it of itensComProduto) {
          const atual = ajustePorProduto.get(it.produtoId) ?? qtdAtualPorId.get(it.produtoId) ?? 0;
          ajustePorProduto.set(it.produtoId, atual + Number(it.quantidade));
        }

        // --- 4. Atualiza saldos em paralelo ---
        await Promise.all(
          Array.from(ajustePorProduto.entries()).map(([produtoId, novaQtd]) =>
            tx.produto.update({
              where: { id: produtoId },
              data: { quantidade: novaQtd.toFixed(4) },
            })
          )
        );

        // --- 5. Movimentos de estoque e itens da entrada em createMany ---
        await tx.movimentoEstoque.createMany({
          data: itensComProduto.map((it) => {
            // saldoApos = quantidade final acumulada (mesma para todos os movs
            // do mesmo produto naquela importação — aceitável; é log)
            const saldoApos = ajustePorProduto.get(it.produtoId)!;
            return {
              produtoId: it.produtoId,
              tipo: "ENTRADA_XML" as const,
              quantidade: it.quantidade,
              saldoApos: saldoApos.toFixed(4),
              precoCusto: it.valorUnitario,
              referenciaId: entrada.id,
              observacao: `NF-e ${data.numeroNf} — ${data.nomeEmitente}`.slice(0, 200),
              usuarioId: user.id,
            };
          }),
        });

        await tx.itemEntradaXml.createMany({
          data: itensComProduto.map((it) => ({
            entradaId: entrada.id,
            produtoId: it.produtoId,
            gtin: it.gtin ?? null,
            descricao: it.descricao,
            quantidade: it.quantidade,
            valorUnitario: it.valorUnitario,
            valorTotal: it.valorTotal,
            criouProduto: it.criouProduto,
          })),
        });

        const novosCount = idsNovos.length;
        const atualizadosCount = data.itens.length - novosCount;
        return { novos: novosCount, atualizados: atualizadosCount };
      },
      { isolationLevel: "Serializable", timeout: 30000, maxWait: 10000 }
    );

    revalidatePath("/estoque");
    revalidatePath("/notas");
    return { novos, atualizados };
  });

  if (r.ok) return { ok: true, novos: r.data.novos, atualizados: r.data.atualizados };
  return { ok: false, erro: r.erro };
}
