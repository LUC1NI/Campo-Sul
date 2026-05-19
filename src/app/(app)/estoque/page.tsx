export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { formatBRL, formatarQuantidade } from "@/lib/format";
import Link from "next/link";
import {
  Plus,
  Upload,
  Package,
  AlertTriangle,
  AlertOctagon,
  Tag,
  ArchiveX,
  Pencil,
} from "lucide-react";
import { Unidade, Prisma } from "@prisma/client";
import { BotaoDesativar } from "./_botao-desativar";
import { BotaoReativar } from "./_botao-reativar";
import { FiltrosEstoque } from "./_filtros-estoque";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const UNIDADE_LABEL: Record<Unidade, string> = {
  UN: "Unidade",
  KG: "Kg",
  L: "Litro",
  SACO: "Saco",
  CX: "Caixa",
  M: "Metro",
};

const POR_PAGINA = 30;

const selectProduto = {
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
  quantidadeMinima: true,
  deletedAt: true,
  categoria: { select: { id: true, nome: true } },
} as const;

type ProdutoRow = {
  id: string;
  codigo: string;
  nome: string;
  unidade: Unidade;
  precoVenda: unknown;
  podeFracionar: boolean;
  pesoUnidade: unknown;
  unidadeFracao: Unidade | null;
  quantidade: unknown;
  saldoFracionado: unknown;
  quantidadeMinima: unknown;
  deletedAt: Date | null;
  categoria: { id: string; nome: string } | null;
};

async function getProdutos(params: {
  q?: string;
  categoria?: string;
  unidade?: string;
  baixo?: boolean;
  fracionavel?: boolean;
  pagina: number;
}) {
  const { q, categoria, unidade, baixo, fracionavel, pagina } = params;

  const baseWhere = {
    ativo: true,
    deletedAt: null,
    ...(q
      ? {
          OR: [
            { nome: { contains: q, mode: "insensitive" as const } },
            { codigo: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(categoria ? { categoriaId: categoria } : {}),
    ...(unidade ? { unidade: unidade as Unidade } : {}),
    ...(fracionavel ? { podeFracionar: true } : {}),
  };

  if (baixo) {
    // Filtro coluna-a-coluna não suportado pelo ORM � usa SQL parametrizado.
    // Seguro: todos os parâmetros são passados via $queryRaw template literal.
    const ids = await prisma.$queryRaw<{ id: string }[]>(
      Prisma.sql`
        SELECT id FROM "Produto"
        WHERE "ativo" = true
          AND "deletedAt" IS NULL
          AND "quantidadeMinima" > 0
          AND "quantidade" <= "quantidadeMinima"
          ${q ? Prisma.sql`AND ("nome" ILIKE ${"%" + q + "%"} OR "codigo" ILIKE ${"%" + q + "%"})` : Prisma.empty}
          ${categoria ? Prisma.sql`AND "categoriaId" = ${categoria}` : Prisma.empty}
          ${unidade ? Prisma.sql`AND "unidade"::text = ${unidade}` : Prisma.empty}
          ${fracionavel ? Prisma.sql`AND "podeFracionar" = true` : Prisma.empty}
        ORDER BY ("quantidade" / NULLIF("quantidadeMinima", 0)) ASC
        LIMIT 500
      `
    );
    if (ids.length === 0) {
      return { produtos: [] as ProdutoRow[], total: 0, paginas: 1 };
    }

    const produtos = await prisma.produto.findMany({
      where: { id: { in: ids.map((r) => r.id) } },
      select: selectProduto,
    });
    // Preserva a ordem do SQL
    const ordem = new Map(ids.map((r, i) => [r.id, i]));
    produtos.sort((a, b) => (ordem.get(a.id) ?? 0) - (ordem.get(b.id) ?? 0));

    return { produtos: produtos as ProdutoRow[], total: produtos.length, paginas: 1 };
  }

  const [produtos, total] = await Promise.all([
    prisma.produto.findMany({
      where: baseWhere,
      select: selectProduto,
      orderBy: { nome: "asc" },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
    prisma.produto.count({ where: baseWhere }),
  ]);

  return { produtos: produtos as ProdutoRow[], total, paginas: Math.ceil(total / POR_PAGINA) };
}

async function getInativos(q?: string, pagina = 1) {
  const where = {
    ativo: false,
    ...(q
      ? {
          OR: [
            { nome: { contains: q, mode: "insensitive" as const } },
            { codigo: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [inativos, total] = await Promise.all([
    prisma.produto.findMany({
      where,
      select: selectProduto,
      orderBy: { deletedAt: "desc" },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
    prisma.produto.count({ where }),
  ]);
  return { inativos: inativos as ProdutoRow[], total, paginas: Math.ceil(total / POR_PAGINA) };
}

type PageParams = {
  q?: string;
  status?: string;
  categoria?: string;
  unidade?: string;
  baixo?: string;
  fracionavel?: string;
  pagina?: string;
};

function TabelaSkeleton() {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-white">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            {["Produto", "Categoria", "Unidade", "Qtd. estoque", "Preço venda", "Ações"].map(
              (h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {Array.from({ length: 8 }).map((_, i) => (
            <tr key={i}>
              <td className="px-4 py-3">
                <div className="mb-1 h-4 w-36 animate-pulse rounded bg-muted" />
                <div className="h-3 w-20 animate-pulse rounded bg-muted" />
              </td>
              <td className="px-4 py-3">
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              </td>
              <td className="px-4 py-3">
                <div className="h-4 w-16 animate-pulse rounded bg-muted" />
              </td>
              <td className="px-4 py-3 text-right">
                <div className="ml-auto h-4 w-20 animate-pulse rounded bg-muted" />
              </td>
              <td className="px-4 py-3 text-right">
                <div className="ml-auto h-4 w-20 animate-pulse rounded bg-muted" />
              </td>
              <td className="px-4 py-3 text-center">
                <div className="mx-auto h-6 w-12 animate-pulse rounded bg-muted" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function TabelaAtivos({ params }: { params: PageParams }) {
  const pagina = Math.max(1, Number(params.pagina) || 1);
  const { produtos, total, paginas } = await getProdutos({
    q: params.q,
    categoria: params.categoria,
    unidade: params.unidade,
    baixo: params.baixo === "1",
    fracionavel: params.fracionavel === "1",
    pagina,
  });

  function buildHref(p: number) {
    const sp = new URLSearchParams();
    if (params.q) sp.set("q", params.q);
    if (params.categoria) sp.set("categoria", params.categoria);
    if (params.unidade) sp.set("unidade", params.unidade);
    if (params.baixo === "1") sp.set("baixo", "1");
    if (params.fracionavel === "1") sp.set("fracionavel", "1");
    if (p > 1) sp.set("pagina", String(p));
    const qs = sp.toString();
    return `/estoque${qs ? `?${qs}` : ""}`;
  }

  return (
    <>
      <p className="-mt-3 text-sm text-muted-foreground">
        {total} produto{total !== 1 ? "s" : ""} encontrado{total !== 1 ? "s" : ""}
      </p>
      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Produto</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Categoria</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Unidade</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                Qtd. estoque
              </th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                Preço venda
              </th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {produtos.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <Package className="mx-auto mb-2 h-8 w-8 opacity-30" />
                  Nenhum produto encontrado
                </td>
              </tr>
            ) : (
              produtos.map((p) => {
                const negativo = Number(p.quantidade) < 0;
                const baixo =
                  !negativo &&
                  Number(p.quantidade) <= Number(p.quantidadeMinima) &&
                  Number(p.quantidadeMinima) > 0;
                return (
                  <tr
                    key={p.id}
                    className={`transition-colors hover:bg-muted/30 ${negativo ? "bg-red-50/40" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{p.nome}</span>
                        {p.podeFracionar && (
                          <span className="rounded bg-bege px-1.5 py-0.5 text-xs text-terra">
                            fracionável
                          </span>
                        )}
                        {negativo && (
                          <AlertOctagon
                            className="h-3.5 w-3.5 text-red-500"
                            aria-label="Estoque negativo � recontar"
                          />
                        )}
                        {baixo && (
                          <AlertTriangle
                            className="h-3.5 w-3.5 text-yellow-500"
                            aria-label="Estoque baixo"
                          />
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{p.codigo}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {p.categoria?.nome ?? "�"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {UNIDADE_LABEL[p.unidade]}
                      {p.podeFracionar && p.unidadeFracao && (
                        <span className="ml-1 text-xs text-muted-foreground/60">
                          (vende em {UNIDADE_LABEL[p.unidadeFracao]})
                        </span>
                      )}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${negativo ? "font-bold text-red-600" : baixo ? "text-yellow-600" : "text-foreground"}`}
                    >
                      {formatarQuantidade(Number(p.quantidade), p.unidade, p.podeFracionar)}{" "}
                      {UNIDADE_LABEL[p.unidade]}
                      {p.podeFracionar && p.pesoUnidade != null && p.unidadeFracao && (
                        <span className="block text-xs font-normal text-muted-foreground">
                          {(
                            Number(p.quantidade) * Number(p.pesoUnidade as string) -
                            Number(p.saldoFracionado as string)
                          ).toFixed(0)}{" "}
                          {UNIDADE_LABEL[p.unidadeFracao]}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-verde-mata">
                      {formatBRL(Number(p.precoVenda))}
                      {p.podeFracionar && p.unidadeFracao && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          /{UNIDADE_LABEL[p.unidadeFracao!]}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Link
                          href={`/estoque/${p.id}`}
                          title="Editar produto"
                          aria-label={`Editar ${p.nome}`}
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-verde-mata/10 hover:text-verde-mata"
                        >
                          <Pencil className="h-4 w-4" aria-hidden />
                        </Link>
                        <BotaoDesativar id={p.id} nome={p.nome} />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {paginas > 1 && <Paginacao pagina={pagina} paginas={paginas} buildHref={buildHref} />}
    </>
  );
}

async function TabelaInativos({ params }: { params: PageParams }) {
  const pagina = Math.max(1, Number(params.pagina) || 1);
  const { inativos, total, paginas } = await getInativos(params.q, pagina);

  function buildHref(p: number) {
    const sp = new URLSearchParams({ status: "inativos" });
    if (params.q) sp.set("q", params.q);
    if (p > 1) sp.set("pagina", String(p));
    return `/estoque?${sp.toString()}`;
  }

  return (
    <>
      <p className="-mt-3 text-sm text-muted-foreground">
        {total} produto{total !== 1 ? "s" : ""} inativo{total !== 1 ? "s" : ""}
      </p>
      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Produto</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Categoria</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Desativado em
              </th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {inativos.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  <ArchiveX className="mx-auto mb-2 h-8 w-8 opacity-30" />
                  Nenhum produto inativo
                </td>
              </tr>
            ) : (
              inativos.map((p) => (
                <tr key={p.id} className="opacity-70 transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <span className="font-medium text-foreground">{p.nome}</span>
                    <div className="text-xs text-muted-foreground">{p.codigo}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.categoria?.nome ?? "�"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {p.deletedAt
                      ? format(new Date(p.deletedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                      : "�"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <BotaoReativar id={p.id} nome={p.nome} />
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

export default async function EstoquePage({ searchParams }: { searchParams: Promise<PageParams> }) {
  const params = await searchParams;
  const verInativos = params.status === "inativos";

  const [categorias, totalInativos] = await Promise.all([
    prisma.categoria.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    verInativos ? Promise.resolve(null) : prisma.produto.count({ where: { ativo: false } }),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-fraunces text-2xl font-bold text-verde-mata">Estoque</h1>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/estoque/categorias"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-muted"
          >
            <Tag className="h-4 w-4" />
            Categorias
          </Link>
          <Link
            href="/estoque/importar-xml"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-muted"
          >
            <Upload className="h-4 w-4" />
            Importar XML
          </Link>
          <Link
            href="/estoque/novo"
            className="inline-flex items-center gap-1.5 rounded-lg bg-verde-mata px-3 py-2 text-sm text-white transition-colors hover:bg-verde-claro"
          >
            <Plus className="h-4 w-4" />
            Novo produto
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-border">
        <Link
          href="/estoque"
          className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            !verInativos
              ? "border-verde-mata text-verde-mata"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Ativos
        </Link>
        <Link
          href="/estoque?status=inativos"
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            verInativos
              ? "border-verde-mata text-verde-mata"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Inativos
          {totalInativos != null && totalInativos > 0 && (
            <span
              className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${
                verInativos ? "bg-verde-mata/15 text-verde-mata" : "bg-muted text-muted-foreground"
              }`}
            >
              {totalInativos}
            </span>
          )}
        </Link>
      </div>

      {!verInativos ? (
        <FiltrosEstoque categorias={categorias} />
      ) : (
        <form className="flex gap-2">
          <input type="hidden" name="status" value="inativos" />
          <input
            name="q"
            defaultValue={params.q}
            placeholder="Buscar por nome..."
            className="max-w-sm flex-1 rounded-lg border border-border px-3.5 py-2 text-sm focus:border-verde-mata focus:outline-none focus:ring-2 focus:ring-verde-mata/30"
          />
          <button
            type="submit"
            className="rounded-lg bg-verde-mata px-4 py-2 text-sm text-white transition-colors hover:bg-verde-claro"
          >
            Buscar
          </button>
        </form>
      )}

      <Suspense key={JSON.stringify(params)} fallback={<TabelaSkeleton />}>
        {verInativos ? <TabelaInativos params={params} /> : <TabelaAtivos params={params} />}
      </Suspense>
    </div>
  );
}
