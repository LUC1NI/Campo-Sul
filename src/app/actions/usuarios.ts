"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") throw new Error("Sem permissão");
  return session.user;
}

export async function listarUsuarios() {
  await requireAdmin();
  return prisma.usuario.findMany({
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
    select: {
      id: true,
      nome: true,
      email: true,
      role: true,
      ativo: true,
      createdAt: true,
    },
  });
}

const criarSchema = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  email: z.string().email("E-mail inválido"),
  senha: z.string().min(6, "Mínimo 6 caracteres"),
  role: z.nativeEnum(Role),
});

export async function criarUsuario(data: z.infer<typeof criarSchema>) {
  await requireAdmin();
  const parsed = criarSchema.parse(data);

  const existe = await prisma.usuario.findUnique({ where: { email: parsed.email } });
  if (existe) throw new Error("E-mail já cadastrado");

  const senhaHash = await bcrypt.hash(parsed.senha, 12);

  await prisma.usuario.create({
    data: {
      nome: parsed.nome,
      email: parsed.email,
      senhaHash,
      role: parsed.role,
    },
  });

  revalidatePath("/usuarios");
}

const editarSchema = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  email: z.string().email("E-mail inválido"),
  role: z.nativeEnum(Role),
  ativo: z.boolean(),
  novaSenha: z.string().optional(),
});

export async function atualizarUsuario(id: string, data: z.infer<typeof editarSchema>) {
  const currentUser = await requireAdmin();
  const parsed = editarSchema.parse(data);

  if (id === currentUser.id) {
    if (!parsed.ativo) throw new Error("Você não pode desativar sua própria conta");
    if (parsed.role !== "ADMIN") throw new Error("Você não pode alterar sua própria função");
  }

  const existe = await prisma.usuario.findFirst({
    where: { email: parsed.email, NOT: { id } },
    select: { id: true },
  });
  if (existe) throw new Error("E-mail já cadastrado por outro usuário");

  const updateData: Record<string, unknown> = {
    nome: parsed.nome,
    email: parsed.email,
    role: parsed.role,
    ativo: parsed.ativo,
  };

  if (parsed.novaSenha && parsed.novaSenha.length >= 6) {
    updateData.senhaHash = await bcrypt.hash(parsed.novaSenha, 12);
  }

  await prisma.usuario.update({ where: { id }, data: updateData });

  revalidatePath("/usuarios");
}
