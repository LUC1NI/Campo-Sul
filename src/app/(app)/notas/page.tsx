export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { formatBRL, formatDataHora, formatCNPJ } from "@/lib/format";
import { FileText, Receipt, Plus, PackageSearch, Truck } from "lucide-react";
import { PdfLink } from "@/components/notas/pdf-link";
import { BotaoEmitirNF } from "@/components/notas/botao-emitir-nf";
import Link from "next/link";
import { TipoDocumento } from "@prisma/client";

const POR_PAGINA = 30;

type PageParams = { q?: string; tipo?: string; pagina?: string; tab?: string };

// ���� Notas Emitidas ��������������������������������������������������������������������������������������������������������������������

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
    <div className="overflow-x-auto rounded-xl border border-border bg-white">
      <table className="w-full min-w-[600px] text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            {["Documento", "Tipo", "Data", "Cliente", "Total", "PDF"].map((h) => (
              <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {Array.from({ length: 8 }).map((_, i) => (
            <tr key={i}>
              <td className="px-4 py-3">
                <div className="mb-1 h-4 w-28 animate-pulse rounded bg-muted" />
                <div className="h-3 w-20 animate-pulse rounded bg-muted" />
              </td>
              <td className="px-4 py-3">
                <div className="h-4 w-20 animate-pulse rounded bg-muted" />
              </td>
              <td className="px-4 py-3">
                <div className="h-4 w-28 animate-pulse rounded bg-muted" />
              </td>
              <td className="px-4 py-3">
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              </td>
              <td className="px-4 py-3">
                <div className="ml-auto h-4 w-20 animate-pulse rounded bg-muted" />
              </td>
              <td className="px-4 py-3">
                <div className="mx-auto h-6 w-16 animate-pulse rounded bg-muted" />
              </td>
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
        <p className="text-sm text-muted-foreground">
          {total} documento{total !== 1 ? "s" : ""}
        </p>
        {comErro > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
            <FileText className="h-3 w-3" />
            {comErro} com erro de PDF
          </span>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Documento</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tipo</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Data</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Cliente</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">PDF</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {notas.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <FileText className="mx-auto mb-2 h-8 w-8 opacity-30" />
                  Nenhum documento encontrado
                </td>
              </tr>
            ) : (
              notas.map((nota) => (
                <tr
                  key={nota.id}
                  className={`transition-colors hover:bg-muted/30 ${nota.statusDoc === "ERRO_PDF" ? "bg-amber-50/40" : ""}`}
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
                        <>
                          <FileText className="h-3.5 w-3.5 text-verde-claro" />
                          <span>Nota Fiscal</span>
                        </>
                      ) : (
                        <>
                          <Receipt className="h-3.5 w-3.5 text-terra" />
                          <span>Recibo</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDataHora(nota.emitidoEm)}
                  </td>
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

// ���� NF-e Recebidas (importações XML) ��������������������������������������������������������������������������������

async function getEntradasXml({ q, pagina }: { q: string; pagina: number }) {
  const where = q
    ? {
        OR: [
          { nomeEmitente: { contains: q, mode: "insensitive" as const } },
          { cnpjEmitente: { contains: q } },
          { numeroNf: { contains: q } },
        ],
      }
    : {};

  const [entradas, total] = await Promise.all([
    prisma.entradaXml.findMany({
      where,
      orderBy: { importadoEm: "desc" },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      select: {
        id: true,
        numeroNf: true,
        cnpjEmitente: true,
        nomeEmitente: true,
        valorTotal: true,
        importadoEm: true,
        _count: { select: { itens: true } },
      },
    }),
    prisma.entradaXml.count({ where }),
  ]);

  return { entradas, total, paginas: Math.ceil(total / POR_PAGINA) };
}

function TabelaXmlSkeleton() {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-white">
      <table className="w-full min-w-[600px] text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            {["NF-e", "Fornecedor", "Data", "Itens", "Total", ""].map((h) => (
              <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {Array.from({ length: 6 }).map((_, i) => (
            <tr key={i}>
              <td className="px-4 py-3">
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              </td>
              <td className="px-4 py-3">
                <div className="mb-1 h-4 w-40 animate-pulse rounded bg-muted" />
                <div className="h-3 w-28 animate-pulse rounded bg-muted" />
              </td>
              <td className="px-4 py-3">
                <div className="h-4 w-28 animate-pulse rounded bg-muted" />
              </td>
              <td className="px-4 py-3">
                <div className="h-4 w-12 animate-pulse rounded bg-muted" />
              </td>
              <td className="px-4 py-3">
                <div className="ml-auto h-4 w-20 animate-pulse rounded bg-muted" />
              </td>
              <td className="px-4 py-3">
                <div className="h-7 w-20 animate-pulse rounded bg-muted" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function EntradasXmlTabela({ params }: { params: PageParams }) {
  const q = (params.q ?? "").trim().slice(0, 80);
  const pagina = Math.max(1, Number(params.pagina) || 1);

  const { entradas, total, paginas } = await getEntradasXml({ q, pagina });

  function buildHref(p: number) {
    const sp = new URLSearchParams();
    sp.set("tab", "recebidas");
    if (q) sp.set("q", q);
    if (p > 1) sp.set("pagina", String(p));
    return `/notas?${sp.toString()}`;
  }

  return (
    <>
      <p className="text-sm text-muted-foreground">
        {total} NF-e{total !== 1 ? "s" : ""} importada{total !== 1 ? "s" : ""}
      </p>

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">NF-e</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fornecedor</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Importada em
              </th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Itens</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entradas.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <Truck className="mx-auto mb-2 h-8 w-8 opacity-30" />
                  Nenhuma NF-e importada ainda
                </td>
              </tr>
            ) : (
              entradas.map((e) => (
                <tr key={e.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium tabular-nums">Nº {e.numeroNf}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium leading-tight text-foreground">{e.nomeEmitente}</p>
                    <p className="text-xs text-muted-foreground">
                      CNPJ: {formatCNPJ(e.cnpjEmitente)}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDataHora(e.importadoEm)}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{e._count.itens}</td>
                  <td className="px-4 py-3 text-right font-semibold text-verde-mata">
                    {formatBRL(Number(e.valorTotal))}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/notas/entrada/${e.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <PackageSearch className="h-3.5 w-3.5" />
                      Ver itens
                    </Link>
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

// ���� Paginação ��������������������������������������������������������������������������������������������������������������������������������

function Paginacao({
  pagina,
  paginas,
  buildHref,
}: {
  pagina: number;
  paginas: number;
  buildHref: (p: number) => string;
}) {
  const pages = buildPages(pagina, paginas);
  return (
    <div className="flex items-center justify-center gap-1.5">
      {pagina > 1 && (
        <Link
          href={buildHref(pagina - 1)}
          className="rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-muted"
        >
          � �
        </Link>
      )}
      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`e-${i}`} className="px-2 text-sm text-muted-foreground">
            ⬦
          </span>
        ) : (
          <Link
            key={p}
            href={buildHref(p as number)}
            className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-colors ${
              p === pagina ? "bg-verde-mata text-white" : "border border-border hover:bg-muted"
            }`}
          >
            {p}
          </Link>
        )
      )}
      {pagina < paginas && (
        <Link
          href={buildHref(pagina + 1)}
          className="rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-muted"
        >
          � 
        </Link>
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

// ���� Page ������������������������������������������������������������������������������������������������������������������������������������������

export default async function NotasPage({ searchParams }: { searchParams: Promise<PageParams> }) {
  const params = await searchParams;
  const tab = params.tab === "recebidas" ? "recebidas" : "emitidas";
  const q = (params.q ?? "").trim().slice(0, 80);
  const tipo = params.tipo ?? "";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-fraunces text-2xl font-bold text-verde-mata">Notas e Recibos</h1>
        {tab === "emitidas" && (
          <Link
            href="/notas/nova"
            className="inline-flex items-center gap-2 rounded-lg bg-verde-mata px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-verde-claro"
          >
            <Plus className="h-4 w-4" />
            Nova Nota
          </Link>
        )}
        {tab === "recebidas" && (
          <Link
            href="/estoque/importar-xml"
            className="inline-flex items-center gap-2 rounded-lg bg-verde-mata px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-verde-claro"
          >
            <Truck className="h-4 w-4" />
            Importar XML
          </Link>
        )}
      </div>

      {/* Abas */}
      <div className="flex gap-1 border-b border-border">
        <Link
          href="/notas"
          className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            tab === "emitidas"
              ? "border-verde-mata text-verde-mata"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="h-4 w-4" />
          Emitidas
        </Link>
        <Link
          href="/notas?tab=recebidas"
          className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            tab === "recebidas"
              ? "border-verde-mata text-verde-mata"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Truck className="h-4 w-4" />
          NF-e Recebidas
        </Link>
      </div>

      {tab === "emitidas" && (
        <>
          <form className="flex flex-wrap gap-2" method="GET">
            <input
              name="q"
              defaultValue={q}
              placeholder="Buscar por cliente ou CPF/CNPJ..."
              className="min-w-[200px] max-w-sm flex-1 rounded-lg border border-border px-3.5 py-2 text-sm focus:border-verde-mata focus:outline-none focus:ring-2 focus:ring-verde-mata/30"
            />
            <select
              name="tipo"
              defaultValue={tipo}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-verde-mata focus:outline-none focus:ring-2 focus:ring-verde-mata/30"
            >
              <option value="">Todos os tipos</option>
              <option value="NOTA">Nota Fiscal</option>
              <option value="RECIBO">Recibo</option>
            </select>
            <button
              type="submit"
              className="rounded-lg bg-verde-mata px-4 py-2 text-sm text-white transition-colors hover:bg-verde-claro"
            >
              Buscar
            </button>
            {(q || tipo) && (
              <Link
                href="/notas"
                className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
              >
                Limpar
              </Link>
            )}
          </form>

          <Suspense key={`emitidas-${JSON.stringify(params)}`} fallback={<TabelaSkeleton />}>
            <NotasTabela params={params} />
          </Suspense>
        </>
      )}

      {tab === "recebidas" && (
        <>
          <form className="flex flex-wrap gap-2" method="GET">
            <input type="hidden" name="tab" value="recebidas" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Buscar por fornecedor, CNPJ ou nº NF-e..."
              className="min-w-[200px] max-w-sm flex-1 rounded-lg border border-border px-3.5 py-2 text-sm focus:border-verde-mata focus:outline-none focus:ring-2 focus:ring-verde-mata/30"
            />
            <button
              type="submit"
              className="rounded-lg bg-verde-mata px-4 py-2 text-sm text-white transition-colors hover:bg-verde-claro"
            >
              Buscar
            </button>
            {q && (
              <Link
                href="/notas?tab=recebidas"
                className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
              >
                Limpar
              </Link>
            )}
          </form>

          <Suspense key={`recebidas-${JSON.stringify(params)}`} fallback={<TabelaXmlSkeleton />}>
            <EntradasXmlTabela params={params} />
          </Suspense>
        </>
      )}
    </div>
  );
}
