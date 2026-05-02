"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Unidade } from "@prisma/client";
import { parseNfeXml } from "@/lib/nfe-xml-parser";

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

export async function parsearXml(
  xmlContent: string
): Promise<{ ok: true; data: XmlPreview } | { ok: false; erro: string }> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  try {
    const parsed = parseNfeXml(xmlContent);

    const existente = await prisma.entradaXml.findUnique({
      where: { chaveAcesso: parsed.chaveAcesso },
      select: { id: true },
    });

    const itens: ItemPreview[] = await Promise.all(
      parsed.itens.map(async (item) => {
        let produtoId: string | null = null;
        let produtoNome: string | null = null;

        if (item.gtin) {
          const produto = await prisma.produto.findFirst({
            where: { gtin: item.gtin, ativo: true },
            select: { id: true, nome: true },
          });
          if (produto) {
            produtoId = produto.id;
            produtoNome = produto.nome;
          }
        }

        return {
          gtin: item.gtin,
          descricao: item.descricao,
          unidadeNfe: item.unidadeComercial,
          quantidade: item.quantidade,
          valorUnitario: item.valorUnitario,
          valorTotal: item.valorTotal,
          produtoId,
          produtoNome,
          unidadeMapeada: mapUnidade(item.unidadeComercial),
        };
      })
    );

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
    return {
      ok: false,
      erro: err instanceof Error ? err.message : "Erro ao processar XML",
    };
  }
}

const itemConfirmSchema = z.object({
  gtin: z.string().nullable(),
  descricao: z.string(),
  unidadeNfe: z.string(),
  quantidade: z.string(),
  valorUnitario: z.string(),
  valorTotal: z.string(),
  produtoId: z.string().nullable(),
  unidadeMapeada: z.nativeEnum(Unidade),
  precoVenda: z.string().optional(),
  categoriaId: z.string().nullable().optional(),
});

const confirmarSchema = z.object({
  chaveAcesso: z.string().min(1),
  numeroNf: z.string(),
  cnpjEmitente: z.string(),
  nomeEmitente: z.string(),
  valorTotal: z.string(),
  xmlOriginal: z.string(),
  itens: z.array(itemConfirmSchema).min(1),
});

export type ConfirmarImportacaoInput = z.infer<typeof confirmarSchema>;

export async function confirmarImportacaoXml(input: ConfirmarImportacaoInput) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") throw new Error("Sem permissão");

  const data = confirmarSchema.parse(input);

  const existente = await prisma.entradaXml.findUnique({
    where: { chaveAcesso: data.chaveAcesso },
    select: { id: true },
  });
  if (existente) throw new Error("Esta NF-e já foi importada anteriormente");

  await prisma.$transaction(
    async (tx) => {
      const entrada = await tx.entradaXml.create({
        data: {
          chaveAcesso: data.chaveAcesso,
          numeroNf: data.numeroNf,
          cnpjEmitente: data.cnpjEmitente,
          nomeEmitente: data.nomeEmitente,
          valorTotal: data.valorTotal,
          xmlOriginal: data.xmlOriginal,
          importadoPorId: session.user.id,
        },
      });

      for (let idx = 0; idx < data.itens.length; idx++) {
        const item = data.itens[idx];
        let produtoId: string;
        let criouProduto = false;

        if (item.produtoId) {
          produtoId = item.produtoId;
        } else {
          const codigo = `IMP-${data.chaveAcesso.slice(-8)}-${String(idx + 1).padStart(3, "0")}`;
          const precoVenda = item.precoVenda ?? item.valorUnitario;

          const novo = await tx.produto.create({
            data: {
              codigo,
              gtin: item.gtin ?? null,
              nome: item.descricao,
              unidade: item.unidadeMapeada,
              precoCusto: item.valorUnitario,
              precoVenda,
              categoriaId: item.categoriaId ?? null,
              quantidade: "0",
            },
          });
          produtoId = novo.id;
          criouProduto = true;
        }

        const produto = await tx.produto.findUniqueOrThrow({ where: { id: produtoId } });
        const novaQtd = (Number(produto.quantidade) + Number(item.quantidade)).toFixed(4);

        await tx.produto.update({
          where: { id: produtoId },
          data: { quantidade: novaQtd, precoCusto: item.valorUnitario },
        });

        await tx.movimentoEstoque.create({
          data: {
            produtoId,
            tipo: "ENTRADA_XML",
            quantidade: item.quantidade,
            saldoApos: novaQtd,
            precoCusto: item.valorUnitario,
            referenciaId: entrada.id,
            observacao: `NF-e ${data.numeroNf} — ${data.nomeEmitente}`,
            usuarioId: session.user.id,
          },
        });

        await tx.itemEntradaXml.create({
          data: {
            entradaId: entrada.id,
            produtoId,
            gtin: item.gtin ?? null,
            descricao: item.descricao,
            quantidade: item.quantidade,
            valorUnitario: item.valorUnitario,
            valorTotal: item.valorTotal,
            criouProduto,
          },
        });
      }
    },
    { isolationLevel: "Serializable" }
  );

  revalidatePath("/estoque");
}
