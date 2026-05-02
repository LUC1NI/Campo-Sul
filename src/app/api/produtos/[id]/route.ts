import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const produto = await prisma.produto.findUnique({ where: { id } });
  if (!produto) return new NextResponse("Not found", { status: 404 });

  return NextResponse.json(produto);
}
