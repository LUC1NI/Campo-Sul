import { requireAdminPage } from "@/lib/auth-helpers";
import { ImportarXmlForm } from "./_importar-xml-form";
import { prisma } from "@/lib/prisma";

export default async function ImportarXmlPage() {
  await requireAdminPage();
  const categorias = await prisma.categoria.findMany({ orderBy: { nome: "asc" } });
  return <ImportarXmlForm categorias={categorias} />;
}
