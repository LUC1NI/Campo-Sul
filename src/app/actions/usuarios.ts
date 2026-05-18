"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  requireAdmin,
  runAction,
  ActionResult,
} from "@/lib/auth-helpers";

export async function listarUsuarios() {
  await requireAdmin();
  return prisma.usuario.findMany({
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
    take: 200, // paginação simples — caso a fazenda tenha mais que isso, criar UI paginada
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
  nome: z.string().min(2, "Nome obrigatório").max(120),
  email: z.string().email("E-mail inválido").toLowerCase().max(200),
  senha: z.string().min(6, "Mínimo 6 caracteres").max(72), // bcrypt limita a 72 bytes
  role: z.nativeEnum(Role),
});

export async function criarUsuario(
  data: z.infer<typeof criarSchema>
): Promise<ActionResult> {
  return runAction("criarUsuario", async () => {
    await requireAdmin();
    const parsed = criarSchema.parse(data);

    const existe = await prisma.usuario.findUnique({
      where: { email: parsed.email },
      select: { id: true },
    });
    if (existe) throw new Error("E-mail já cadastrado.");

    const senhaHash = await bcrypt.hash(parsed.senha, 12);

    await prisma.usuario.create({
      data: {
        nome: parsed.nome.trim(),
        email: parsed.email,
        senhaHash,
        role: parsed.role,
      },
    });

    revalidatePath("/usuarios");
  });
}

const editarSchema = z.object({
  nome: z.string().min(2, "Nome obrigatório").max(120),
  email: z.string().email("E-mail inválido").toLowerCase().max(200),
  role: z.nativeEnum(Role),
  ativo: z.boolean(),
  novaSenha: z.string().min(6).max(72).optional().or(z.literal("")),
});

export async function atualizarUsuario(
  id: string,
  data: z.infer<typeof editarSchema>
): Promise<ActionResult> {
  return runAction("atualizarUsuario", async () => {
    const currentUser = await requireAdmin();
    const parsed = editarSchema.parse(data);

    if (id === currentUser.id) {
      if (!parsed.ativo) throw new Error("Você não pode desativar sua própria conta.");
      if (parsed.role !== "ADMIN")
        throw new Error("Você não pode alterar sua própria função.");
    }

    const existe = await prisma.usuario.findFirst({
      where: { email: parsed.email, NOT: { id } },
      select: { id: true },
    });
    if (existe) throw new Error("E-mail já cadastrado por outro usuário.");

    const updateData: {
      nome: string;
      email: string;
      role: Role;
      ativo: boolean;
      senhaHash?: string;
    } = {
      nome: parsed.nome.trim(),
      email: parsed.email,
      role: parsed.role,
      ativo: parsed.ativo,
    };

    if (parsed.novaSenha && parsed.novaSenha.length >= 6) {
      updateData.senhaHash = await bcrypt.hash(parsed.novaSenha, 12);
    }

    await prisma.usuario.update({ where: { id }, data: updateData });

    revalidatePath("/usuarios");
  });
}
