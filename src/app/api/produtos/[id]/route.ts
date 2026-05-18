import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// Campos públicos (qualquer usuário autenticado pode ler)
const SELECT_PUBLICO = {
  id: true,
  codigo: true,
  gtin: true,
  nome: true,
  descricao: true,
  categoriaId: true,
  unidade: true,
  precoVenda: true,
  podeFracionar: true,
  pesoUnidade: true,
  unidadeFracao: true,
  precoFracao: true,
  quantidade: true,
  saldoFracionado: true,
  quantidadeMinima: true,
  ativo: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

// Campos restritos a ADMIN (margem de lucro)
const SELECT_ADMIN = {
  ...SELECT_PUBLICO,
  precoCusto: true,
} as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  if (typeof id !== "string" || id.length === 0 || id.length > 64) {
    return new NextResponse("Bad request", { status: 400 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const produto = await prisma.produto.findUnique({
    where: { id },
    select: isAdmin ? SELECT_ADMIN : SELECT_PUBLICO,
  });
  if (!produto) return new NextResponse("Not found", { status: 404 });

  return NextResponse.json(produto, {
    headers: { "Cache-Control": "private, max-age=0, must-revalidate" },
  });
}
