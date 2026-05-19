import { ImportarXmlForm } from "./_importar-xml-form";
import { prisma } from "@/lib/prisma";

export default async function ImportarXmlPage() {
  const categorias = await prisma.categoria.findMany({ orderBy: { nome: "asc" } });
  return <ImportarXmlForm categorias={categorias} />;
}
