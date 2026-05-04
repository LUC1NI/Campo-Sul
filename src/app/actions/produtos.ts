"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Unidade } from "@prisma/client";
import { Prisma } from "@prisma/client";

function normalizarNumero(v: string | null | undefined): string {
  if (!v) return "";
  return String(v).replace(",", ".").trim();
}

const produtoSchema = z.object({
  codigo: z.string().min(1, "Código obrigatório"),
  gtin: z.string().optional().nullable(),
  nome: z.string().min(2, "Nome obrigatório"),
  descricao: z.string().optional().nullable(),
  categoriaId: z.string().optional().nullable(),
  unidade: z.nativeEnum(Unidade),
  precoCusto: z.string().refine((v) => !isNaN(Number(normalizarNumero(v))) && Number(normalizarNumero(v)) >= 0, "Valor inválido"),
  precoVenda: z.string().refine((v) => !isNaN(Number(normalizarNumero(v))) && Number(normalizarNumero(v)) > 0, "Valor inválido"),
  podeFracionar: z.boolean().default(false),
  pesoUnidade: z.string().optional().nullable(),
  unidadeFracao: z.nativeEnum(Unidade).optional().nullable(),
  quantidade: z.string().refine((v) => !isNaN(Number(normalizarNumero(v))) && Number(normalizarNumero(v)) >= 0, "Valor inválido"),
  quantidadeMinima: z.string().refine((v) => !isNaN(Number(normalizarNumero(v))) && Number(normalizarNumero(v)) >= 0, "Valor inválido"),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAuth() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user;
}

function tratarErroPrisma(err: unknown, escopo: "criar" | "atualizar"): string {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const campos = (err.meta?.target as string[] | undefined) ?? [];
      if (campos.includes("codigo")) return "Já existe um produto com esse código interno.";
      if (campos.includes("gtin")) return "Já existe um produto com esse GTIN/EAN.";
      return "Valor duplicado em campo único.";
    }
    if (err.code === "P2025") return "Produto não encontrado.";
  }
  if (err instanceof z.ZodError) {
    return err.issues.map((i) => i.message).join(", ");
  }
  console.error(`[produtos] erro ao ${escopo}:`, err);
  return err instanceof Error ? err.message : "Erro desconhecido ao salvar produto.";
}

export async function criarProduto(formData: z.infer<typeof produtoSchema>): Promise<ActionResult> {
  try {
    await requireAuth();
    const data = produtoSchema.parse(formData);

    if (data.podeFracionar && !data.pesoUnidade) {
      return { ok: false, error: "Peso da unidade é obrigatório quando o produto pode ser fracionado." };
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
        pesoUnidade: data.pesoUnidade ? normalizarNumero(data.pesoUnidade) : null,
        unidadeFracao: data.unidadeFracao || null,
        quantidade: normalizarNumero(data.quantidade),
        quantidadeMinima: normalizarNumero(data.quantidadeMinima),
      },
    });

    revalidatePath("/estoque");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: tratarErroPrisma(err, "criar") };
  }
}

export async function atualizarProduto(id: string, formData: z.infer<typeof produtoSchema>): Promise<ActionResult> {
  try {
    await requireAuth();
    const data = produtoSchema.parse(formData);

    if (data.podeFracionar && !data.pesoUnidade) {
      return { ok: false, error: "Peso da unidade é obrigatório quando o produto pode ser fracionado." };
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
        pesoUnidade: data.pesoUnidade ? normalizarNumero(data.pesoUnidade) : null,
        unidadeFracao: data.unidadeFracao || null,
        quantidadeMinima: normalizarNumero(data.quantidadeMinima),
      },
    });

    revalidatePath("/estoque");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: tratarErroPrisma(err, "atualizar") };
  }
}

const ajusteSchema = z.object({
  novaQuantidade: z.string().refine((v) => !isNaN(Number(v)) && Number(v) >= 0, "Valor inválido"),
  observacao: z.string().optional(),
});

export async function ajustarEstoque(produtoId: string, formData: z.infer<typeof ajusteSchema>) {
  const user = await requireAuth();
  const data = ajusteSchema.parse(formData);

  await prisma.$transaction(async (tx) => {
    const produto = await tx.produto.findUniqueOrThrow({ where: { id: produtoId } });
    const diff = Number(data.novaQuantidade) - Number(produto.quantidade);

    await tx.produto.update({
      where: { id: produtoId },
      data: { quantidade: data.novaQuantidade },
    });

    await tx.movimentoEstoque.create({
      data: {
        produtoId,
        tipo: "AJUSTE",
        quantidade: String(diff),
        saldoApos: data.novaQuantidade,
        observacao: data.observacao || null,
        usuarioId: user.id,
      },
    });
  }, { isolationLevel: "Serializable" });

  revalidatePath("/estoque");
  revalidatePath(`/estoque/${produtoId}`);
}

export async function reativarProduto(id: string) {
  const user = await requireAuth();
  if (user.role !== "ADMIN") throw new Error("Sem permissão");
  await prisma.produto.update({
    where: { id },
    data: { ativo: true, deletedAt: null },
  });
  revalidatePath("/estoque");
}

export async function desativarProduto(id: string) {
  const user = await requireAuth();
  if (user.role !== "ADMIN") throw new Error("Sem permissão");

  await prisma.produto.update({
    where: { id },
    data: { ativo: false, deletedAt: new Date() },
  });

  revalidatePath("/estoque");
}

export async function listarCategorias() {
  return prisma.categoria.findMany({ orderBy: { nome: "asc" } });
}

export async function criarCategoria(nome: string) {
  await requireAuth();
  const cat = await prisma.categoria.upsert({
    where: { nome },
    update: {},
    create: { nome },
  });
  revalidatePath("/estoque");
  revalidatePath("/estoque/categorias");
  return cat;
}

export async function renomearCategoria(id: string, nome: string) {
  await requireAuth();
  const cat = await prisma.categoria.update({ where: { id }, data: { nome } });
  revalidatePath("/estoque");
  revalidatePath("/estoque/categorias");
  return cat;
}

export async function excluirCategoria(id: string) {
  await requireAuth();
  const count = await prisma.produto.count({ where: { categoriaId: id, ativo: true } });
  if (count > 0) throw new Error(`Categoria possui ${count} produto(s) ativo(s). Remova-os antes de excluir.`);
  await prisma.categoria.delete({ where: { id } });
  revalidatePath("/estoque");
  revalidatePath("/estoque/categorias");
}
