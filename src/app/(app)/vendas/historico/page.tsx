export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { buscarVendas } from "@/app/actions/vendas";
import { prisma } from "@/lib/prisma";
import { formatBRL, formatDataHora } from "@/lib/format";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { PdfLink } from "@/components/notas/pdf-link";

const METODO_LABEL: Record<string, string> = {
  DINHEIRO: "Dinheiro", DEBITO: "Débito", CREDITO: "Crédito", PIX: "PIX",
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
    <div className="bg-white rounded-xl border border-border overflow-x-auto">
      <table className="w-full text-sm min-w-[560px]">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            {["Venda", "Data", "Vendedor", "Pagamentos", "Total", "Status"].map((h) => (
              <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {Array.from({ length: 8 }).map((_, i) => (
            <tr key={i}>
              <td className="px-4 py-3"><div className="h-4 w-16 bg-muted rounded animate-pulse" /></td>
              <td className="px-4 py-3"><div className="h-4 w-32 bg-muted rounded animate-pulse" /></td>
              <td className="px-4 py-3"><div className="h-4 w-24 bg-muted rounded animate-pulse" /></td>
              <td className="px-4 py-3"><div className="h-4 w-36 bg-muted rounded animate-pulse" /></td>
              <td className="px-4 py-3"><div className="h-4 w-20 bg-muted rounded animate-pulse ml-auto" /></td>
              <td className="px-4 py-3"><div className="h-5 w-20 bg-muted rounded-full animate-pulse mx-auto" /></td>
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
      <p className="text-sm text-muted-foreground -mt-3">{total} venda{total !== 1 ? "s" : ""}</p>

      <div className="bg-white rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Venda</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Data</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Vendedor</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Pagamentos</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {vendas.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  Nenhuma venda encontrada
                </td>
              </tr>
            ) : (
              vendas.map((v) => (
                <tr key={v.id} className="hover:bg-muted/30 transition-colors">
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
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {v.pagamentos.map((p) => `${METODO_LABEL[p.metodo]}: R$${Number(p.valor).toFixed(2)}`).join(" · ")}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-verde-mata">
                    {formatBRL(Number(v.total))}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      v.status === "CONCLUIDA"
                        ? "bg-verde-mata/10 text-verde-mata"
                        : "bg-destructive/10 text-destructive"
                    }`}>
                      {v.status === "CONCLUIDA" ? "Concluída" : "Cancelada"}
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
            <Link href={buildHref(params, { pagina: String(pagina - 1) })} className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted transition-colors">←</Link>
          )}
          {pages.map((p, i) =>
            p === "..." ? (
              <span key={`e-${i}`} className="px-2 text-muted-foreground text-sm">…</span>
            ) : (
              <Link
                key={p}
                href={buildHref(params, { pagina: String(p) })}
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors ${
                  p === pagina ? "bg-verde-mata text-white" : "border border-border hover:bg-muted"
                }`}
              >
                {p}
              </Link>
            )
          )}
          {pagina < paginas && (
            <Link href={buildHref(params, { pagina: String(pagina + 1) })} className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted transition-colors">→</Link>
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
  const temFiltro = !!(params.periodo || params.vendedor || params.metodo || params.status || params.q);

  const PERIODOS = [
    { value: "todos", label: "Todos" },
    { value: "hoje", label: "Hoje" },
    { value: "7d", label: "7 dias" },
    { value: "30d", label: "30 dias" },
  ];

  return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="font-fraunces text-2xl font-bold text-verde-mata">Histórico de Vendas</h1>
          <Link href="/vendas" className="text-sm text-verde-mata hover:underline">← PDV</Link>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl border border-border p-4 space-y-3">
          {/* Período — navegação direta (Links) */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground mr-1">Período:</span>
            {PERIODOS.map((p) => (
              <Link
                key={p.value}
                href={buildHref(params, { periodo: p.value, pagina: "1" })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  periodo === p.value
                    ? "bg-verde-mata text-white"
                    : "border border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {p.label}
              </Link>
            ))}
          </div>

          {/* Outros filtros — GET form */}
          <form method="GET" className="flex flex-wrap gap-2">
            {/* Preserva o período atual */}
            {periodo !== "todos" && <input type="hidden" name="periodo" value={periodo} />}

            <select
              name="vendedor"
              defaultValue={params.vendedor ?? ""}
              className="px-3 py-2 rounded-lg border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-verde-mata/30 focus:border-verde-mata"
            >
              <option value="">Todos os vendedores</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>{u.nome}</option>
              ))}
            </select>

            <select
              name="metodo"
              defaultValue={params.metodo ?? ""}
              className="px-3 py-2 rounded-lg border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-verde-mata/30 focus:border-verde-mata"
            >
              <option value="">Todos os métodos</option>
              <option value="DINHEIRO">Dinheiro</option>
              <option value="DEBITO">Débito</option>
              <option value="CREDITO">Crédito</option>
              <option value="PIX">PIX</option>
            </select>

            <select
              name="status"
              defaultValue={params.status ?? ""}
              className="px-3 py-2 rounded-lg border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-verde-mata/30 focus:border-verde-mata"
            >
              <option value="">Todos os status</option>
              <option value="CONCLUIDA">Concluídas</option>
              <option value="CANCELADA">Canceladas</option>
            </select>

            <input
              name="q"
              type="text"
              inputMode="numeric"
              defaultValue={params.q ?? ""}
              placeholder="Buscar #"
              className="w-28 px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-verde-mata/30 focus:border-verde-mata"
            />

            <button
              type="submit"
              className="px-4 py-2 bg-verde-mata text-white rounded-lg text-sm hover:bg-verde-claro transition-colors"
            >
              Filtrar
            </button>

            {temFiltro && (
              <Link
                href="/vendas/historico"
                className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition-colors"
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
