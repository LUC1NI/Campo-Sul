import { AppLayout } from "@/components/app/app-layout";
import { prisma } from "@/lib/prisma";
import { CategoriasClient } from "./_categorias-client";

async function getCategorias() {
  return prisma.categoria.findMany({
    orderBy: { nome: "asc" },
    include: { _count: { select: { produtos: true } } },
  });
}

export default async function CategoriasPage() {
  const categorias = await getCategorias();

  return (
    <AppLayout>
      <CategoriasClient categorias={categorias} />
    </AppLayout>
  );
}
