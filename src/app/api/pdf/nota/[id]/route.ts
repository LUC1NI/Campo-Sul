import { auth } from "@/lib/auth";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { CupomDoc } from "@/components/pdf/cupom-doc";
import { formatDataHora } from "@/lib/format";
import React from "react";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  if (!z.string().cuid().safeParse(id).success) return new NextResponse("Not found", { status: 404 });

  // Funcionário só abre documento das próprias vendas (dados de cliente: CPF/nome).
  const doc = await prisma.documento.findFirst({
    where: {
      id,
      ...(session.user.role === "ADMIN" ? {} : { venda: { usuarioId: session.user.id } }),
    },
    include: {
      venda: {
        include: {
          itens: true,
          pagamentos: true,
        },
      },
    },
  });

  if (!doc) return new NextResponse("Not found", { status: 404 });

  const empresa = {
    razaoSocial: process.env.EMPRESA_RAZAO_SOCIAL ?? "CampoSul Agropecuária",
    cnpj: process.env.EMPRESA_CNPJ ?? "00.000.000/0001-00",
    endereco: process.env.EMPRESA_ENDERECO ?? "",
    fone: process.env.EMPRESA_FONE ?? "",
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = React.createElement(CupomDoc as any, {
    numero: doc.numero,
    serie: doc.serie,
    data: formatDataHora(doc.emitidoEm),
    itens: doc.venda.itens.map((item) => ({
      nomeProduto: item.nomeProduto,
      quantidade: String(item.quantidade),
      unidadeVenda: item.unidadeVenda,
      precoUnitario: String(item.precoUnitario),
      total: String(item.total),
    })),
    subtotal: String(doc.venda.subtotal),
    desconto: String(doc.venda.desconto),
    total: String(doc.venda.total),
    pagamentos: doc.venda.pagamentos.map((p) => ({
      metodo: p.metodo,
      valor: String(p.valor),
    })),
    empresa,
    tipo: doc.tipo,
    cpfCnpj: doc.cpfCnpj,
    nomeCliente: doc.nomeCliente,
  });

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await renderToBuffer(element as any);

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="nota-${doc.numero}.pdf"`,
        // Sem cache: "emitir nota" converte recibo em nota no mesmo id.
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[PDF] Falha ao renderizar documento", id, err);
    return new NextResponse(
      JSON.stringify({ erro: "Falha ao renderizar PDF" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
