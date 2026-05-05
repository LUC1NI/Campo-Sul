import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

const MAX_QUERY_LEN = 80;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const raw = req.nextUrl.searchParams.get("q") ?? "";
  const q = raw.trim().slice(0, MAX_QUERY_LEN);
  if (q.length < 1) return NextResponse.json([]);

  const produtos = await prisma.produto.findMany({
    where: {
      ativo: true,
      deletedAt: null,
      OR: [
        { nome: { contains: q, mode: "insensitive" } },
        { codigo: { equals: q } },
        { gtin: { equals: q } },
      ],
    },
    select: {
      id: true,
      codigo: true,
      nome: true,
      unidade: true,
      precoVenda: true,
      podeFracionar: true,
      pesoUnidade: true,
      unidadeFracao: true,
      quantidade: true,
      saldoFracionado: true,
    },
    take: 8,
    orderBy: { nome: "asc" },
  });

  return NextResponse.json(produtos, {
    headers: { "Cache-Control": "private, max-age=5, stale-while-revalidate=30" },
  });
}
