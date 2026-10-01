import { auth } from "@/lib/auth";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { EtiquetasDoc, EtiquetaPdf } from "@/components/pdf/etiquetas-doc";
import { buscarLayout, larguraModulo } from "@/lib/etiquetas-layouts";
import { escolherCodigo, larguras, QUIET_ZONE } from "@/lib/codigo-barras";
import { formatBRL } from "@/lib/format";
import React from "react";

const MAX_ETIQUETAS = 1000;

const UNIDADE: Record<string, string> = { UN: "un", KG: "kg", L: "L", SACO: "saco", CX: "cx", M: "m" };

const lista = (v: string | null) => (v ?? "").split(",").filter(Boolean);
const querySchema = z
  .object({
    ids: z.array(z.string().cuid()).min(1, "Nenhum produto selecionado").max(200, "Máximo de 200 produtos por vez"),
    copias: z.array(z.coerce.number().int().min(1).max(500)),
    layout: z.string().max(40),
  })
  .refine((q) => q.copias.length === q.ids.length, "Quantidade de cópias inválida")
  .refine((q) => q.copias.reduce((s, n) => s + n, 0) <= MAX_ETIQUETAS, `Máximo de ${MAX_ETIQUETAS} etiquetas por vez`);

/** Erro legível na aba que abriu o PDF. */
const erro = (msg: string, status = 400) =>
  new NextResponse(msg, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const sp = req.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    ids: lista(sp.get("ids")),
    copias: lista(sp.get("copias")),
    layout: sp.get("layout") ?? "",
  });
  if (!parsed.success) return erro(parsed.error.issues[0]?.message ?? "Parâmetros inválidos");
  const { ids, copias, layout: layoutId } = parsed.data;

  const layout = buscarLayout(layoutId);
  if (!layout) return erro("Layout de etiqueta desconhecido");

  // Etiqueta só tem dado público (nome, preço de venda, código) — qualquer usuário logado imprime.
  const produtos = await prisma.produto.findMany({
    where: { id: { in: ids }, deletedAt: null },
    select: { id: true, codigo: true, gtin: true, nome: true, unidade: true, precoVenda: true },
  });
  const porId = new Map(produtos.map((p) => [p.id, p]));

  const etiquetas: EtiquetaPdf[] = [];
  for (const [i, id] of ids.entries()) {
    const p = porId.get(id);
    if (!p) return erro("Produto não encontrado ou desativado", 404);

    const cod = escolherCodigo(p);
    if (!cod.ok) return erro(`${p.nome}: ${cod.erro}`);

    const barras = larguras(cod.simbologia, cod.texto);
    const quietZone = QUIET_ZONE[cod.simbologia];
    const modulo = larguraModulo(barras.reduce((s, n) => s + n, 0) + 2 * quietZone, layout.largura, layout.dpi);
    if (!modulo) {
      return erro(
        `${p.nome}: o código "${cod.texto}" é longo demais para a etiqueta "${layout.nome}" — as barras ficariam finas demais para o leitor. Escolha uma etiqueta maior ou encurte o código do produto.`
      );
    }

    const e: EtiquetaPdf = {
      nome: p.nome.slice(0, 120),
      preco: `${formatBRL(String(p.precoVenda))} / ${UNIDADE[p.unidade] ?? p.unidade}`,
      texto: cod.texto,
      barras,
      quietZone,
      modulo,
    };
    for (let c = 0; c < copias[i]; c++) etiquetas.push(e);
  }

  try {
    const element = React.createElement(EtiquetasDoc, { layout, etiquetas });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdf = await renderToBuffer(element as any);
    return new NextResponse(pdf as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="etiquetas.pdf"`,
        // Preço muda: nunca servir etiqueta velha do cache.
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[PDF] Falha ao renderizar etiquetas", err);
    return erro("Falha ao gerar o PDF das etiquetas", 500);
  }
}
