import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

const MAX_QUERY_LEN = 80;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const raw = req.nextUrl.searchParams.get("q") ?? "";
  const q = raw.trim().slice(0, MAX_QUERY_LEN);
  if (q.length < 1) return NextResponse.json([]);

  // Match exato de código/EAN vem primeiro: o PDV usa isso para o leitor de
  // código de barras adicionar direto (ver busca-produto.tsx).
  const [exato, produtos] = await Promise.all([
    prisma.produto.findFirst({
      where: { ativo: true, deletedAt: null, OR: [{ codigo: q }, { gtin: q }] },
      select: SELECT,
    }),
    prisma.produto.findMany({
      where: {
        ativo: true,
        deletedAt: null,
        OR: [
          { nome: { contains: q, mode: "insensitive" } },
          { codigo: { startsWith: q, mode: "insensitive" } },
        ],
      },
      select: SELECT,
      take: 8,
      orderBy: { nome: "asc" },
    }),
  ]);

  const lista = exato
    ? [exato, ...produtos.filter((p) => p.id !== exato.id)].slice(0, 8)
    : produtos;
  return NextResponse.json(lista, { headers: CACHE });
}

// Cache curto + revalidação em background. Reduz hits ao DB em rajadas
// (digitação rápida no PDV) sem deixar o resultado obsoleto.
const CACHE = { "Cache-Control": "private, max-age=10, stale-while-revalidate=60" };

const SELECT = {
  id: true,
  codigo: true,
  gtin: true,
  nome: true,
  unidade: true,
  precoVenda: true,
  podeFracionar: true,
  pesoUnidade: true,
  unidadeFracao: true,
  quantidade: true,
  saldoFracionado: true,
  precoFracao: true,
} satisfies Prisma.ProdutoSelect;
