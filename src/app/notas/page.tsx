export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AppLayout } from "@/components/app/app-layout";
import { prisma } from "@/lib/prisma";
import { formatBRL, formatDataHora } from "@/lib/format";
import { FileText, Receipt } from "lucide-react";
import { PdfLink } from "@/components/notas/pdf-link";
import { BotaoEmitirNF } from "@/components/notas/botao-emitir-nf";
import Link from "next/link";
import { TipoDocumento } from "@prisma/client";

const POR_PAGINA = 30;

type PageParams = { q?: string; tipo?: string; pagina?: string };

async function getNotas({ q, tipo, pagina }: { q: string; tipo: string; pagina: number }) {
  const where = {
    ...(tipo === "NOTA" || tipo === "RECIBO" ? { tipo: tipo as TipoDocumento } : {}),
    ...(q
      ? {
          OR: [
            { nomeCliente: { contains: q, mode: "insensitive" as const } },
            { cpfCnpj: { contains: q } },
          ],
        }
      : {}),
  };

  const [notas, total] = await Promise.all([
    prisma.documento.findMany({
      where,
      orderBy: { emitidoEm: "desc" },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      select: {
        id: true,
        tipo: true,
        numero: true,
        serie: true,
        nomeCliente: true,
        cpfCnpj: true,
        pdfPath: true,
        statusDoc: true,
        erroInfo: true,
        emitidoEm: true,
        venda: { select: { total: true, numero: true } },
        emitidoPor: { select: { nome: true } },
      },
    }),
    prisma.documento.count({ where }),
  ]);

  return { notas, total, paginas: Math.ceil(total / POR_PAGINA) };
}

function TabelaSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-border overflow-x-auto">
      <table className="w-full text-sm min-w-[600px]">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            {["Documento", "Tipo", "Data", "Cliente", "Total", "PDF"].map((h) => (
              <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {Array.from({ length: 8 }).map((_, i) => (
            <tr key={i}>
              <td className="px-4 py-3">
                <div className="h-4 w-28 bg-muted rounded animate-pulse mb-1" />
                <div className="h-3 w-20 bg-muted rounded animate-pulse" />
              </td>
              <td className="px-4 py-3"><div className="h-4 w-20 bg-muted rounded animate-pulse" /></td>
              <td className="px-4 py-3"><div className="h-4 w-28 bg-muted rounded animate-pulse" /></td>
              <td className="px-4 py-3"><div className="h-4 w-32 bg-muted rounded animate-pulse" /></td>
              <td className="px-4 py-3"><div className="h-4 w-20 bg-muted rounded animate-pulse ml-auto" /></td>
              <td className="px-4 py-3"><div className="h-6 w-16 bg-muted rounded animate-pulse mx-auto" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function NotasTabela({ params }: { params: PageParams }) {
  const q = (params.q ?? "").trim().slice(0, 80);
  const tipo = params.tipo ?? "";
  const pagina = Math.max(1, Number(params.pagina) || 1);

  const { notas, total, paginas } = await getNotas({ q, tipo, pagina });
  const comErro = notas.filter((n) => n.statusDoc === "ERRO_PDF").length;

  function buildHref(p: number) {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (tipo) sp.set("tipo", tipo);
    if (p > 1) sp.set("pagina", String(p));
    const qs = sp.toString();
    return `/notas${qs ? `?${qs}` : ""}`;
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <p className="text-sm text-muted-foreground">{total} documento{total !== 1 ? "s" : ""}</p>
        {comErro > 0 && (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            <FileText className="w-3 h-3" />
            {comErro} com erro de PDF
          </span>
        )}
      </div>

      <div className="bg-white rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Documento</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tipo</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Data</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cliente</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">PDF</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {notas.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  Nenhum documento encontrado
                </td>
              </tr>
            ) : (
              notas.map((nota) => (
                <tr
                  key={nota.id}
                  className={`hover:bg-muted/30 transition-colors ${nota.statusDoc === "ERRO_PDF" ? "bg-amber-50/40" : ""}`}
                >
                  <td className="px-4 py-3">
                    <span className="font-medium">
                      Nº {String(nota.numero).padStart(6, "0")} / {nota.serie}
                    </span>
                    <div className="text-xs text-muted-foreground">Venda #{nota.venda.numero}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {nota.tipo === "NOTA" ? (
                        <><FileText className="w-3.5 h-3.5 text-verde-claro" /><span>Nota Fiscal</span></>
                      ) : (
                        <><Receipt className="w-3.5 h-3.5 text-terra" /><span>Recibo</span></>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDataHora(nota.emitidoEm)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {nota.nomeCliente || nota.cpfCnpj || "Não identificado"}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-verde-mata">
                    {formatBRL(Number(nota.venda.total))}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex flex-col items-center gap-1.5">
                      <PdfLink
                        documentoId={nota.id}
                        tipo={nota.tipo}
                        numero={nota.numero}
                        statusDoc={nota.statusDoc}
                        erroInfo={nota.erroInfo}
                      />
                      {nota.tipo === "RECIBO" && (
                        <BotaoEmitirNF documentoId={nota.id} numeroRecibo={nota.numero} />
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {paginas > 1 && <Paginacao pagina={pagina} paginas={paginas} buildHref={buildHref} />}
    </>
  );
}

function Paginacao({ pagina, paginas, buildHref }: { pagina: number; paginas: number; buildHref: (p: number) => string }) {
  const pages = buildPages(pagina, paginas);
  return (
    <div className="flex items-center justify-center gap-1.5">
      {pagina > 1 && (
        <Link href={buildHref(pagina - 1)} className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted transition-colors">←</Link>
      )}
      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`e-${i}`} className="px-2 text-muted-foreground text-sm">…</span>
        ) : (
          <Link
            key={p}
            href={buildHref(p as number)}
            className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors ${
              p === pagina ? "bg-verde-mata text-white" : "border border-border hover:bg-muted"
            }`}
          >
            {p}
          </Link>
        )
      )}
      {pagina < paginas && (
        <Link href={buildHref(pagina + 1)} className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted transition-colors">→</Link>
      )}
    </div>
  );
}

function buildPages(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  if (current > 3) pages.push("...");
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p);
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}

export default async function NotasPage({
  searchParams,
}: {
  searchParams: Promise<PageParams>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 80);
  const tipo = params.tipo ?? "";

  return (
    <AppLayout>
      <div className="space-y-5">
        <div>
          <h1 className="font-fraunces text-2xl font-bold text-verde-mata">Notas e Recibos</h1>
        </div>

        <form className="flex flex-wrap gap-2" method="GET">
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por cliente ou CPF/CNPJ..."
            className="flex-1 min-w-[200px] max-w-sm px-3.5 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-verde-mata/30 focus:border-verde-mata"
          />
          <select
            name="tipo"
            defaultValue={tipo}
            className="px-3 py-2 rounded-lg border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-verde-mata/30 focus:border-verde-mata"
          >
            <option value="">Todos os tipos</option>
            <option value="NOTA">Nota Fiscal</option>
            <option value="RECIBO">Recibo</option>
          </select>
          <button type="submit" className="px-4 py-2 bg-verde-mata text-white rounded-lg text-sm hover:bg-verde-claro transition-colors">
            Buscar
          </button>
          {(q || tipo) && (
            <Link href="/notas" className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition-colors">
              Limpar
            </Link>
          )}
        </form>

        <Suspense key={JSON.stringify(params)} fallback={<TabelaSkeleton />}>
          <NotasTabela params={params} />
        </Suspense>
      </div>
    </AppLayout>
  );
}
