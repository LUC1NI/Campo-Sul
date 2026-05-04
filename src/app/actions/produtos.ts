"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Unidade, Prisma } from "@prisma/client";

function normalizarNumero(v: string | null | undefined): string {
  if (!v) return "0";
  return String(v).replace(",", ".").trim();
}

const REGEX_CODIGO = /^[A-Za-z0-9._-]+$/;
const REGEX_GTIN = /^\d{8,14}$/;

const produtoSchema = z.object({
  codigo: z.string()
    .min(1, "Código obrigatório")
    .max(40, "Código longo demais (máx. 40 caracteres)")
    .regex(REGEX_CODIGO, "Use apenas letras, números, hífen, ponto ou underline"),
  gtin: z.string().optional().nullable()
    .refine((v) => !v || REGEX_GTIN.test(v.trim()), "GTIN deve ter de 8 a 14 dígitos numéricos"),
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
  quantidade: z.string().refine((v) => {
    const n = Number(normalizarNumero(v));
    return !isNaN(n) && n >= 0 && n < 10_000_000;
  }, "Quantidade inválida"),
  quantidadeMinima: z.string().refine((v) => {
    const n = Number(normalizarNumero(v));
    return !isNaN(n) && n >= 0 && n < 10_000_000;
  }, "Quantidade mínima inválida"),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAuth() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user;
}

async function requireAdmin() {
  const user = await requireAuth();
  if (user.role !== "ADMIN") throw new Error("Apenas administradores podem realizar essa ação.");
  return user;
}

function tratarErroProduto(err: unknown, escopo: string): string {
  if (err instanceof z.ZodError) {
    return err.issues.map((i) => i.message).join(" · ");
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const campos = (err.meta?.target as string[] | undefined) ?? [];
      if (campos.includes("codigo")) return "Já existe um produto com esse código interno.";
      if (campos.includes("gtin")) return "Já existe um produto com esse GTIN/EAN.";
      return "Já existe um registro com esse valor único.";
    }
    if (err.code === "P2025") return "Produto não encontrado.";
  }
  console.error(`[produtos] erro ao ${escopo}:`, err);
  return err instanceof Error ? err.message : "Erro desconhecido ao salvar produto.";
}

export async function criarProduto(formData: z.infer<typeof produtoSchema>): Promise<ActionResult> {
  try {
    await requireAuth();
    const data = produtoSchema.parse(formData);

    if (data.podeFracionar) {
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
    }

    if (data.categoriaId) {
      const cat = await prisma.categoria.findUnique({ where: { id: data.categoriaId } });
      if (!cat) return { ok: false, error: "Categoria selecionada não existe." };
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
        pesoUnidade: data.podeFracionar && data.pesoUnidade ? normalizarNumero(data.pesoUnidade) : null,
        unidadeFracao: data.podeFracionar ? data.unidadeFracao : null,
        quantidade: normalizarNumero(data.quantidade),
        quantidadeMinima: normalizarNumero(data.quantidadeMinima),
      },
    });

    revalidatePath("/estoque");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: tratarErroProduto(err, "criar") };
  }
}

export async function atualizarProduto(id: string, formData: z.infer<typeof produtoSchema>): Promise<ActionResult> {
  try {
    await requireAuth();
    if (!id || typeof id !== "string") return { ok: false, error: "ID inválido." };

    const data = produtoSchema.parse(formData);

    if (data.podeFracionar) {
      if (!data.pesoUnidade) {
        return { ok: false, error: "Peso da unidade é obrigatório para venda fracionada." };
      }
      if (!data.unidadeFracao) {
        return { ok: false, error: "Unidade fracionada é obrigatória para venda fracionada." };
      }
    }

    if (data.categoriaId) {
      const cat = await prisma.categoria.findUnique({ where: { id: data.categoriaId } });
      if (!cat) return { ok: false, error: "Categoria selecionada não existe." };
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
        pesoUnidade: data.podeFracionar && data.pesoUnidade ? normalizarNumero(data.pesoUnidade) : null,
        unidadeFracao: data.podeFracionar ? data.unidadeFracao : null,
        quantidadeMinima: normalizarNumero(data.quantidadeMinima),
      },
    });

    revalidatePath("/estoque");
    revalidatePath(`/estoque/${id}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: tratarErroProduto(err, "atualizar") };
  }
}

const ajusteSchema = z.object({
  novaQuantidade: z.string().refine((v) => {
    const n = Number(normalizarNumero(v));
    return !isNaN(n) && n >= 0 && n < 10_000_000;
  }, "Quantidade inválida"),
  observacao: z.string().max(500).optional(),
});

export async function ajustarEstoque(produtoId: string, formData: z.infer<typeof ajusteSchema>): Promise<ActionResult> {
  try {
    const user = await requireAuth();
    if (!produtoId) return { ok: false, error: "Produto inválido." };
    const data = ajusteSchema.parse(formData);
    const novaQtd = normalizarNumero(data.novaQuantidade);

    await prisma.$transaction(async (tx) => {
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
    }, { isolationLevel: "Serializable" });

    revalidatePath("/estoque");
    revalidatePath(`/estoque/${produtoId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: tratarErroProduto(err, "ajustar estoque") };
  }
}

export async function reativarProduto(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    await prisma.produto.update({
      where: { id },
      data: { ativo: true, deletedAt: null },
    });
    revalidatePath("/estoque");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: tratarErroProduto(err, "reativar") };
  }
}

export async function desativarProduto(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    await prisma.produto.update({
      where: { id },
      data: { ativo: false, deletedAt: new Date() },
    });
    revalidatePath("/estoque");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: tratarErroProduto(err, "desativar") };
  }
}

export async function listarCategorias() {
  await requireAuth();
  return prisma.categoria.findMany({ orderBy: { nome: "asc" } });
}

const categoriaNomeSchema = z.string()
  .min(2, "Nome deve ter pelo menos 2 caracteres")
  .max(50, "Nome muito longo");

export async function criarCategoria(nome: string) {
  await requireAuth();
  const nomeValidado = categoriaNomeSchema.parse(nome.trim());
  const cat = await prisma.categoria.upsert({
    where: { nome: nomeValidado },
    update: {},
    create: { nome: nomeValidado },
  });
  revalidatePath("/estoque");
  revalidatePath("/estoque/categorias");
  return cat;
}

export async function renomearCategoria(id: string, nome: string) {
  await requireAuth();
  const nomeValidado = categoriaNomeSchema.parse(nome.trim());
  const cat = await prisma.categoria.update({ where: { id }, data: { nome: nomeValidado } });
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
