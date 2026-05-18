"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Unidade } from "@prisma/client";
import {
  requireActiveUser,
  requireAdmin,
  runAction,
  ActionResult,
} from "@/lib/auth-helpers";

function normalizarNumero(v: string | null | undefined): string {
  if (!v) return "0";
  return String(v).replace(",", ".").trim();
}

const REGEX_CODIGO = /^[A-Za-z0-9._-]+$/;
const REGEX_GTIN = /^\d{8,14}$/;

const produtoSchema = z.object({
  codigo: z
    .string()
    .min(1, "Código obrigatório")
    .max(40, "Código longo demais (máx. 40 caracteres)")
    .regex(REGEX_CODIGO, "Use apenas letras, números, hífen, ponto ou underline"),
  gtin: z
    .string()
    .optional()
    .nullable()
    .refine(
      (v) => !v || REGEX_GTIN.test(v.trim()),
      "GTIN deve ter de 8 a 14 dígitos numéricos"
    ),
  nome: z.string().min(2, "Nome obrigatório").max(200, "Nome longo demais"),
  descricao: z.string().max(1000, "Descrição longa demais").optional().nullable(),
  categoriaId: z.string().optional().nullable(),
  unidade: z.nativeEnum(Unidade),
  precoCusto: z.string().refine((v) => {
    const n = Number(normalizarNumero(v));
    return !isNaN(n) && n >= 0 && n < 1_000_000;
  }, "Preço de custo inválido"),
  precoVenda: z.string().refine((v) => {
    const n = Number(normalizarNumero(v));
    return !isNaN(n) && n > 0 && n < 1_000_000;
  }, "Preço de venda deve ser maior que zero"),
  podeFracionar: z.boolean().default(false),
  pesoUnidade: z.string().optional().nullable(),
  unidadeFracao: z.nativeEnum(Unidade).optional().nullable(),
  precoFracao: z.string().optional().nullable(),
  quantidade: z.string().refine((v) => {
    const n = Number(normalizarNumero(v));
    return !isNaN(n) && n >= 0 && n < 10_000_000;
  }, "Quantidade inválida"),
  quantidadeMinima: z.string().refine((v) => {
    const n = Number(normalizarNumero(v));
    return !isNaN(n) && n >= 0 && n < 10_000_000;
  }, "Quantidade mínima inválida"),
});

// Compat: o form usa `result.error` em vez de `result.erro`.
// Mantemos esse formato apenas para esses 3 callers e expomos
// também o padrão novo via runAction nos outros.
export type ProdutoActionResult = { ok: true } | { ok: false; error: string };

function validarFracionamento(
  data: z.infer<typeof produtoSchema>
): ProdutoActionResult | null {
  if (!data.podeFracionar) return null;
  if (!data.pesoUnidade) {
    return { ok: false, error: "Peso da unidade é obrigatório para venda fracionada." };
  }
  if (!data.unidadeFracao) {
    return { ok: false, error: "Unidade fracionada é obrigatória para venda fracionada." };
  }
  const peso = Number(normalizarNumero(data.pesoUnidade));
  if (isNaN(peso) || peso <= 0) {
    return { ok: false, error: "Peso da unidade deve ser maior que zero." };
  }
  return null;
}

export async function criarProduto(
  formData: z.infer<typeof produtoSchema>
): Promise<ProdutoActionResult> {
  const r = await runAction("criarProduto", async () => {
    await requireActiveUser();
    const data = produtoSchema.parse(formData);

    const fracErr = validarFracionamento(data);
    if (fracErr) throw new Error(fracErr.ok === false ? fracErr.error : "");

    if (data.categoriaId) {
      const cat = await prisma.categoria.findUnique({ where: { id: data.categoriaId } });
      if (!cat) throw new Error("Categoria selecionada não existe.");
    }

    await prisma.produto.create({
      data: {
        codigo: data.codigo.trim(),
        gtin: data.gtin?.trim() || null,
        nome: data.nome.trim(),
        descricao: data.descricao?.trim() || null,
        categoriaId: data.categoriaId || null,
        unidade: data.unidade,
        precoCusto: normalizarNumero(data.precoCusto),
        precoVenda: normalizarNumero(data.precoVenda),
        podeFracionar: data.podeFracionar,
        pesoUnidade:
          data.podeFracionar && data.pesoUnidade
            ? normalizarNumero(data.pesoUnidade)
            : null,
        unidadeFracao: data.podeFracionar ? data.unidadeFracao : null,
        precoFracao:
          data.podeFracionar && data.precoFracao
            ? normalizarNumero(data.precoFracao)
            : null,
        quantidade: normalizarNumero(data.quantidade),
        quantidadeMinima: normalizarNumero(data.quantidadeMinima),
      },
    });

    revalidatePath("/estoque");
  });
  return r.ok ? { ok: true } : { ok: false, error: r.erro };
}

export async function atualizarProduto(
  id: string,
  formData: z.infer<typeof produtoSchema>
): Promise<ProdutoActionResult> {
  const r = await runAction("atualizarProduto", async () => {
    await requireActiveUser();
    if (!id || typeof id !== "string") throw new Error("ID inválido.");

    const data = produtoSchema.parse(formData);

    const fracErr = validarFracionamento(data);
    if (fracErr) throw new Error(fracErr.ok === false ? fracErr.error : "");

    if (data.categoriaId) {
      const cat = await prisma.categoria.findUnique({ where: { id: data.categoriaId } });
      if (!cat) throw new Error("Categoria selecionada não existe.");
    }

    await prisma.produto.update({
      where: { id },
      data: {
        codigo: data.codigo.trim(),
        gtin: data.gtin?.trim() || null,
        nome: data.nome.trim(),
        descricao: data.descricao?.trim() || null,
        categoriaId: data.categoriaId || null,
        unidade: data.unidade,
        precoCusto: normalizarNumero(data.precoCusto),
        precoVenda: normalizarNumero(data.precoVenda),
        podeFracionar: data.podeFracionar,
        pesoUnidade:
          data.podeFracionar && data.pesoUnidade
            ? normalizarNumero(data.pesoUnidade)
            : null,
        unidadeFracao: data.podeFracionar ? data.unidadeFracao : null,
        precoFracao:
          data.podeFracionar && data.precoFracao
            ? normalizarNumero(data.precoFracao)
            : null,
        quantidadeMinima: normalizarNumero(data.quantidadeMinima),
      },
    });

    revalidatePath("/estoque");
    revalidatePath(`/estoque/${id}`);
  });
  return r.ok ? { ok: true } : { ok: false, error: r.erro };
}

const ajusteSchema = z.object({
  novaQuantidade: z.string().refine((v) => {
    const n = Number(normalizarNumero(v));
    return !isNaN(n) && n >= 0 && n < 10_000_000;
  }, "Quantidade inválida"),
  observacao: z.string().max(500).optional(),
});

export async function ajustarEstoque(
  produtoId: string,
  formData: z.infer<typeof ajusteSchema>
): Promise<ProdutoActionResult> {
  const r = await runAction("ajustarEstoque", async () => {
    const user = await requireActiveUser();
    if (!produtoId) throw new Error("Produto inválido.");
    const data = ajusteSchema.parse(formData);
    const novaQtd = normalizarNumero(data.novaQuantidade);

    await prisma.$transaction(
      async (tx) => {
        const produto = await tx.produto.findUniqueOrThrow({ where: { id: produtoId } });
        const diff = Number(novaQtd) - Number(produto.quantidade);

        await tx.produto.update({
          where: { id: produtoId },
          data: { quantidade: novaQtd },
        });

        await tx.movimentoEstoque.create({
          data: {
            produtoId,
            tipo: "AJUSTE",
            quantidade: String(diff),
            saldoApos: novaQtd,
            observacao: data.observacao?.trim() || null,
            usuarioId: user.id,
          },
        });
      },
      { isolationLevel: "Serializable" }
    );

    revalidatePath("/estoque");
    revalidatePath(`/estoque/${produtoId}`);
  });
  return r.ok ? { ok: true } : { ok: false, error: r.erro };
}

export async function reativarProduto(id: string): Promise<ProdutoActionResult> {
  const r = await runAction("reativarProduto", async () => {
    await requireAdmin();
    await prisma.produto.update({
      where: { id },
      data: { ativo: true, deletedAt: null },
    });
    revalidatePath("/estoque");
  });
  return r.ok ? { ok: true } : { ok: false, error: r.erro };
}

export async function desativarProduto(id: string): Promise<ProdutoActionResult> {
  const r = await runAction("desativarProduto", async () => {
    await requireAdmin();
    await prisma.produto.update({
      where: { id },
      data: { ativo: false, deletedAt: new Date() },
    });
    revalidatePath("/estoque");
  });
  return r.ok ? { ok: true } : { ok: false, error: r.erro };
}

export async function listarCategorias() {
  await requireActiveUser();
  return prisma.categoria.findMany({ orderBy: { nome: "asc" } });
}

const categoriaNomeSchema = z
  .string()
  .min(2, "Nome deve ter pelo menos 2 caracteres")
  .max(50, "Nome muito longo");

export type CategoriaResult = ActionResult<{ id: string; nome: string }>;

export async function criarCategoria(nome: string): Promise<CategoriaResult> {
  return runAction("criarCategoria", async () => {
    await requireActiveUser();
    const nomeValidado = categoriaNomeSchema.parse(nome.trim());
    const cat = await prisma.categoria.upsert({
      where: { nome: nomeValidado },
      update: {},
      create: { nome: nomeValidado },
      select: { id: true, nome: true },
    });
    revalidatePath("/estoque");
    revalidatePath("/estoque/categorias");
    return cat;
  });
}

export async function renomearCategoria(
  id: string,
  nome: string
): Promise<CategoriaResult> {
  return runAction("renomearCategoria", async () => {
    await requireActiveUser();
    const nomeValidado = categoriaNomeSchema.parse(nome.trim());
    const cat = await prisma.categoria.update({
      where: { id },
      data: { nome: nomeValidado },
      select: { id: true, nome: true },
    });
    revalidatePath("/estoque");
    revalidatePath("/estoque/categorias");
    return cat;
  });
}

export async function excluirCategoria(id: string): Promise<ActionResult> {
  return runAction("excluirCategoria", async () => {
    await requireActiveUser();
    const count = await prisma.produto.count({ where: { categoriaId: id, ativo: true } });
    if (count > 0) {
      throw new Error(
        `Categoria possui ${count} produto(s) ativo(s). Remova-os antes de excluir.`
      );
    }
    await prisma.categoria.delete({ where: { id } });
    revalidatePath("/estoque");
    revalidatePath("/estoque/categorias");
  });
}
