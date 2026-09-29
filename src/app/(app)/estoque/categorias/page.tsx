import { requireAdminPage } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { CategoriasClient } from "./_categorias-client";

async function getCategorias() {
  return prisma.categoria.findMany({
    orderBy: { nome: "asc" },
    include: { _count: { select: { produtos: true } } },
  });
}

export default async function CategoriasPage() {
  await requireAdminPage();
  const categorias = await getCategorias();

  return <CategoriasClient categorias={categorias} />;
}
