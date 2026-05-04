"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Unidade } from "@prisma/client";

const produtoSchema = z.object({
  codigo: z.string().min(1, "Código obrigatório"),
  gtin: z.string().optional().nullable(),
  nome: z.string().min(2, "Nome obrigatório"),
  descricao: z.string().optional().nullable(),
  categoriaId: z.string().optional().nullable(),
  unidade: z.nativeEnum(Unidade),
  precoCusto: z.string().refine((v) => !isNaN(Number(v)) && Number(v) >= 0, "Valor inválido"),
  precoVenda: z.string().refine((v) => !isNaN(Number(v)) && Number(v) > 0, "Valor inválido"),
  podeFracionar: z.boolean().default(false),
  pesoUnidade: z.string().optional().nullable(),
  unidadeFracao: z.nativeEnum(Unidade).optional().nullable(),
  quantidade: z.string().refine((v) => !isNaN(Number(v)) && Number(v) >= 0, "Valor inválido"),
  quantidadeMinima: z.string().refine((v) => !isNaN(Number(v)) && Number(v) >= 0, "Valor inválido"),
});

async function requireAuth() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user;
}

export async function criarProduto(formData: z.infer<typeof produtoSchema>) {
  await requireAuth();
  const data = produtoSchema.parse(formData);

  if (data.podeFracionar && !data.pesoUnidade) {
    throw new Error("Peso da unidade obrigatório para produto fracionável");
  }

  await prisma.produto.create({
    data: {
      codigo: data.codigo,
      gtin: data.gtin || null,
      nome: data.nome,
      descricao: data.descricao || null,
      categoriaId: data.categoriaId || null,
      unidade: data.unidade,
      precoCusto: data.precoCusto,
      precoVenda: data.precoVenda,
      podeFracionar: data.podeFracionar,
      pesoUnidade: data.pesoUnidade || null,
      unidadeFracao: data.unidadeFracao || null,
      quantidade: data.quantidade,
      quantidadeMinima: data.quantidadeMinima,
    },
  });

  revalidatePath("/estoque");
}

export async function atualizarProduto(id: string, formData: z.infer<typeof produtoSchema>) {
  await requireAuth();
  const data = produtoSchema.parse(formData);

  await prisma.produto.update({
    where: { id },
    data: {
      codigo: data.codigo,
      gtin: data.gtin || null,
      nome: data.nome,
      descricao: data.descricao || null,
      categoriaId: data.categoriaId || null,
      unidade: data.unidade,
      precoCusto: data.precoCusto,
      precoVenda: data.precoVenda,
      podeFracionar: data.podeFracionar,
      pesoUnidade: data.pesoUnidade || null,
      unidadeFracao: data.unidadeFracao || null,
      quantidadeMinima: data.quantidadeMinima,
    },
  });

  revalidatePath("/estoque");
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
