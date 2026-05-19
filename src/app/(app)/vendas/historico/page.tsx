export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { buscarVendas } from "@/app/actions/vendas";
import { prisma } from "@/lib/prisma";
import { formatBRL, formatDataHora } from "@/lib/format";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { PdfLink } from "@/components/notas/pdf-link";

const METODO_LABEL: Record<string, string> = {
  DINHEIRO: "Dinheiro",
  DEBITO: "DÃ©bito",
  CREDITO: "CrÃ©dito",
  PIX: "PIX",
};

type PageParams = {
  pagina?: string;
  periodo?: string;
  vendedor?: string;
  metodo?: string;
  status?: string;
  q?: string;
};

function buildPages(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  if (current > 3) pages.push("...");
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p);
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}

function buildHref(params: PageParams, updates: Partial<PageParams>) {
  const merged = { ...params, ...updates };
  const sp = new URLSearchParams();
  if (merged.periodo && merged.periodo !== "todos") sp.set("periodo", merged.periodo);
  if (merged.vendedor) sp.set("vendedor", merged.vendedor);
  if (merged.metodo) sp.set("metodo", merged.metodo);
  if (merged.status) sp.set("status", merged.status);
  if (merged.q) sp.set("q", merged.q);
  if (merged.pagina && Number(merged.pagina) > 1) sp.set("pagina", merged.pagina);
  const qs = sp.toString();
  return `/vendas/historico${qs ? `?${qs}` : ""}`;
}

function TabelaSkeleton() {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-white">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            {["Venda", "Data", "Vendedor", "Pagamentos", "Total", "Status"].map((h) => (
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
                <div className="h-4 w-16 animate-pulse rounded bg-muted" />
              </td>
              <td className="px-4 py-3">
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              </td>
              <td className="px-4 py-3">
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              </td>
              <td className="px-4 py-3">
                <div className="h-4 w-36 animate-pulse rounded bg-muted" />
              </td>
              <td className="px-4 py-3">
                <div className="ml-auto h-4 w-20 animate-pulse rounded bg-muted" />
              </td>
              <td className="px-4 py-3">
                <div className="mx-auto h-5 w-20 animate-pulse rounded-full bg-muted" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function HistoricoTabela({ params }: { params: PageParams }) {
  const pagina = Math.max(1, Number(params.pagina) || 1);
  const { vendas, total, paginas } = await buscarVendas(pagina, 30, {
    periodo: params.periodo,
    usuarioId: params.vendedor,
    metodo: params.metodo,
    status: params.status,
    q: params.q,
  });

  const pages = buildPages(pagina, paginas);

  return (
    <>
      <p className="-mt-3 text-sm text-muted-foreground">
        {total} venda{total !== 1 ? "s" : ""}
      </p>

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Venda</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Data</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Vendedor</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Pagamentos</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {vendas.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <ShoppingCart className="mx-auto mb-2 h-8 w-8 opacity-30" />
                  Nenhuma venda encontrada
                </td>
              </tr>
            ) : (
              vendas.map((v) => (
                <tr key={v.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">
                    #{v.numero}
                    {v.documento && (
                      <span className="ml-2 inline-block">
                        <PdfLink
                          documentoId={v.documento.id}
                          tipo={v.documento.tipo}
                          numero={v.documento.numero}
                          statusDoc={v.documento.statusDoc}
                          erroInfo={v.documento.erroInfo}
                        />
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDataHora(v.createdAt)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{v.usuario.nome}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {v.pagamentos
                      .map((p) => `${METODO_LABEL[p.metodo]}: R$${Number(p.valor).toFixed(2)}`)
                      .join(" Â· ")}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-verde-mata">
                    {formatBRL(Number(v.total))}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        v.status === "CONCLUIDA"
                          ? "bg-verde-mata/10 text-verde-mata"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {v.status === "CONCLUIDA" ? "ConcluÃ­da" : "Cancelada"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {paginas > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {pagina > 1 && (
            <Link
              href={buildHref(params, { pagina: String(pagina - 1) })}
              className="rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-muted"
            >
              â†
            </Link>
          )}
          {pages.map((p, i) =>
            p === "..." ? (
              <span key={`e-${i}`} className="px-2 text-sm text-muted-foreground">
                â€¦
              </span>
            ) : (
              <Link
                key={p}
                href={buildHref(params, { pagina: String(p) })}
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
              href={buildHref(params, { pagina: String(pagina + 1) })}
              className="rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-muted"
            >
              â†’
            </Link>
          )}
        </div>
      )}
    </>
  );
}

export default async function HistoricoVendasPage({
  searchParams,
}: {
  searchParams: Promise<PageParams>;
}) {
  const params = await searchParams;

  const usuarios = await prisma.usuario.findMany({
    where: { ativo: true },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });

  const periodo = params.periodo ?? "todos";
  const temFiltro = !!(
    params.periodo ||
    params.vendedor ||
    params.metodo ||
    params.status ||
    params.q
  );

  const PERIODOS = [
    { value: "todos", label: "Todos" },
    { value: "hoje", label: "Hoje" },
    { value: "7d", label: "7 dias" },
    { value: "30d", label: "30 dias" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-fraunces text-2xl font-bold text-verde-mata">HistÃ³rico de Vendas</h1>
        <Link href="/vendas" className="text-sm text-verde-mata hover:underline">
          â† PDV
        </Link>
      </div>

      {/* Filtros */}
      <div className="space-y-3 rounded-xl border border-border bg-white p-4">
        {/* PerÃ­odo â€” navegaÃ§Ã£o direta (Links) */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-muted-foreground">PerÃ­odo:</span>
          {PERIODOS.map((p) => (
            <Link
              key={p.value}
              href={buildHref(params, { periodo: p.value, pagina: "1" })}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                periodo === p.value
                  ? "bg-verde-mata text-white"
                  : "border border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {p.label}
            </Link>
          ))}
        </div>

        {/* Outros filtros â€” GET form */}
        <form method="GET" className="flex flex-wrap gap-2">
          {/* Preserva o perÃ­odo atual */}
          {periodo !== "todos" && <input type="hidden" name="periodo" value={periodo} />}

          <select
            name="vendedor"
            defaultValue={params.vendedor ?? ""}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-verde-mata focus:outline-none focus:ring-2 focus:ring-verde-mata/30"
          >
            <option value="">Todos os vendedores</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>

          <select
            name="metodo"
            defaultValue={params.metodo ?? ""}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-verde-mata focus:outline-none focus:ring-2 focus:ring-verde-mata/30"
          >
            <option value="">Todos os mÃ©todos</option>
            <option value="DINHEIRO">Dinheiro</option>
            <option value="DEBITO">DÃ©bito</option>
            <option value="CREDITO">CrÃ©dito</option>
            <option value="PIX">PIX</option>
          </select>

          <select
            name="status"
            defaultValue={params.status ?? ""}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-verde-mata focus:outline-none focus:ring-2 focus:ring-verde-mata/30"
          >
            <option value="">Todos os status</option>
            <option value="CONCLUIDA">ConcluÃ­das</option>
            <option value="CANCELADA">Canceladas</option>
          </select>

          <input
            name="q"
            type="text"
            inputMode="numeric"
            defaultValue={params.q ?? ""}
            placeholder="Buscar #"
            className="w-28 rounded-lg border border-border px-3 py-2 text-sm focus:border-verde-mata focus:outline-none focus:ring-2 focus:ring-verde-mata/30"
          />

          <button
            type="submit"
            className="rounded-lg bg-verde-mata px-4 py-2 text-sm text-white transition-colors hover:bg-verde-claro"
          >
            Filtrar
          </button>

          {temFiltro && (
            <Link
              href="/vendas/historico"
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
            >
              Limpar
            </Link>
          )}
        </form>
      </div>

      <Suspense key={JSON.stringify(params)} fallback={<TabelaSkeleton />}>
        <HistoricoTabela params={params} />
      </Suspense>
    </div>
  );
}
