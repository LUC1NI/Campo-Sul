export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { formatBRL, formatData, formatDataHora } from "@/lib/format";
import {
  ShoppingCart,
  TrendingUp,
  AlertOctagon,
  DollarSign,
  ArrowUp,
  ArrowDown,
  Minus,
} from "lucide-react";
import Link from "next/link";

// Cache de 20s â€” equilÃ­brio entre frescor e custo no Supabase free.
// Tag "dashboard" pode ser invalidada explicitamente em actions de venda
// para refletir imediato. Como a chave inclui a data, vira-se sozinho Ã  meia-noite.
const getDashboardData = unstable_cache(async () => getDashboardDataRaw(), ["dashboard-data-v1"], {
  revalidate: 20,
  tags: ["dashboard"],
});

async function getDashboardDataRaw() {
  const now = new Date();
  const inicioHoje = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const fimHoje = new Date(inicioHoje.getTime() + 86400000);
  const inicioOntem = new Date(inicioHoje.getTime() - 86400000);

  const [
    vendasHoje,
    totalHojeAgg,
    vendasOntem,
    totalOntemAgg,
    ultimasVendas,
    produtosAtivos,
    porMetodo,
    topProdutos,
    estoqueCritico,
    estoqueNegativo,
  ] = await Promise.all([
    prisma.venda.count({
      where: { createdAt: { gte: inicioHoje, lt: fimHoje }, status: "CONCLUIDA" },
    }),
    prisma.venda.aggregate({
      where: { createdAt: { gte: inicioHoje, lt: fimHoje }, status: "CONCLUIDA" },
      _sum: { total: true },
    }),
    prisma.venda.count({
      where: { createdAt: { gte: inicioOntem, lt: inicioHoje }, status: "CONCLUIDA" },
    }),
    prisma.venda.aggregate({
      where: { createdAt: { gte: inicioOntem, lt: inicioHoje }, status: "CONCLUIDA" },
      _sum: { total: true },
    }),
    prisma.venda.findMany({
      where: { status: "CONCLUIDA" },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        numero: true,
        total: true,
        createdAt: true,
        usuario: { select: { nome: true } },
      },
    }),
    prisma.produto.count({ where: { ativo: true, deletedAt: null } }),
    prisma.pagamento.groupBy({
      by: ["metodo"],
      where: { venda: { createdAt: { gte: inicioHoje, lt: fimHoje }, status: "CONCLUIDA" } },
      _sum: { valor: true },
      orderBy: { _sum: { valor: "desc" } },
    }),
    prisma.itemVenda.groupBy({
      by: ["nomeProduto"],
      where: { venda: { createdAt: { gte: inicioHoje, lt: fimHoje }, status: "CONCLUIDA" } },
      _sum: { quantidade: true, total: true },
      orderBy: { _sum: { quantidade: "desc" } },
      take: 5,
    }),
    prisma.produto.findMany({
      where: { ativo: true, deletedAt: null, quantidadeMinima: { gt: 0 } },
      select: { id: true, nome: true, quantidade: true, quantidadeMinima: true, unidade: true },
      orderBy: { nome: "asc" },
      take: 50,
    }),
    prisma.produto.findMany({
      where: { ativo: true, deletedAt: null, quantidade: { lt: 0 } },
      select: { id: true, nome: true, quantidade: true, unidade: true },
      orderBy: { quantidade: "asc" },
      take: 8,
    }),
  ]);

  const totalHoje = Number(totalHojeAgg._sum.total ?? 0);
  const totalOntem = Number(totalOntemAgg._sum.total ?? 0);
  const ticketMedio = vendasHoje > 0 ? totalHoje / vendasHoje : 0;

  // Normaliza topProdutos para o formato esperado pela UI
  const topProdutosNorm = topProdutos.map((p) => ({
    nome: p.nomeProduto,
    qtd: String(p._sum.quantidade ?? 0),
    total_val: String(p._sum.total ?? 0),
  }));

  // Filtra em JS os que estÃ£o abaixo do mÃ­nimo (coluna-a-coluna nÃ£o suportado pelo ORM)
  const estoqueCriticoFilt = estoqueCritico
    .filter((p) => Number(p.quantidade) <= Number(p.quantidadeMinima))
    .sort((a, b) => {
      const ratioA = Number(a.quantidade) / (Number(a.quantidadeMinima) || 1);
      const ratioB = Number(b.quantidade) / (Number(b.quantidadeMinima) || 1);
      return ratioA - ratioB;
    })
    .slice(0, 8)
    .map((p) => ({
      id: p.id,
      nome: p.nome,
      quantidade: String(p.quantidade),
      quantidadeMinima: String(p.quantidadeMinima),
      unidade: String(p.unidade),
    }));

  const estoqueNegativoNorm = estoqueNegativo.map((p) => ({
    id: p.id,
    nome: p.nome,
    quantidade: String(p.quantidade),
    unidade: String(p.unidade),
  }));

  return {
    vendasHoje,
    vendasOntem,
    totalHoje,
    totalOntem,
    ticketMedio,
    ultimasVendas,
    produtosAtivos,
    porMetodo,
    topProdutos: topProdutosNorm,
    estoqueCritico: estoqueCriticoFilt,
    estoqueNegativo: estoqueNegativoNorm,
  };
}

const METODO_LABEL: Record<string, string> = {
  DINHEIRO: "Dinheiro",
  DEBITO: "DÃ©bito",
  CREDITO: "CrÃ©dito",
  PIX: "PIX",
};
const UNIDADE_LABEL: Record<string, string> = {
  UN: "un",
  KG: "kg",
  L: "L",
  SACO: "saco",
  CX: "cx",
  M: "m",
};

function Variacao({ atual, anterior }: { atual: number; anterior: number }) {
  if (anterior === 0)
    return <span className="mt-1 text-xs text-muted-foreground">primeiro registro</span>;
  const pct = Math.round(((atual - anterior) / anterior) * 100);
  if (pct === 0)
    return (
      <span className="mt-1 flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" /> igual a ontem
      </span>
    );
  const positivo = pct > 0;
  return (
    <span
      className={`mt-1 flex items-center gap-0.5 text-xs ${positivo ? "text-emerald-600" : "text-red-500"}`}
    >
      {positivo ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {Math.abs(pct)}% vs ontem
    </span>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-3">
      <div>
        <div className="h-6 w-28 animate-pulse rounded-lg bg-muted" />
        <div className="mt-1 h-3.5 w-56 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid grid-cols-2 gap-3 desk:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="h-3 w-20 animate-pulse rounded bg-muted" />
              <div className="h-7 w-7 animate-pulse rounded-lg bg-muted" />
            </div>
            <div className="h-6 w-20 animate-pulse rounded bg-muted" />
            <div className="mt-1 h-3 w-24 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 desk:grid-cols-5">
        <div className="rounded-xl border border-border bg-white desk:col-span-3">
          <div className="border-b border-border px-4 py-3">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between border-b border-border px-4 py-2.5 last:border-0"
            >
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-border bg-white p-4 desk:col-span-2">
          <div className="mb-3 h-4 w-24 animate-pulse rounded bg-muted" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-1.5">
              <div className="h-4 w-16 animate-pulse rounded bg-muted" />
              <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

async function DashboardContent() {
  const {
    vendasHoje,
    vendasOntem,
    totalHoje,
    totalOntem,
    ticketMedio,
    ultimasVendas,
    produtosAtivos,
    porMetodo,
    topProdutos,
    estoqueCritico,
    estoqueNegativo,
  } = await getDashboardData();

  return (
    <div className="space-y-3">
      {/* CabeÃ§alho */}
      <div>
        <h1 className="font-fraunces text-lg font-bold text-verde-mata">Dashboard</h1>
        <p className="text-xs text-muted-foreground">
          {formatData(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy")}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 desk:grid-cols-4">
        {/* Vendas hoje */}
        <div className="rounded-xl border border-border bg-white p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Vendas hoje
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-verde-mata/10 text-verde-mata">
              <ShoppingCart className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="font-fraunces text-xl font-bold text-foreground">{vendasHoje}</div>
          <Variacao atual={vendasHoje} anterior={vendasOntem} />
        </div>

        {/* Faturamento */}
        <div className="rounded-xl border border-border bg-white p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Faturamento
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-terra/10 text-terra">
              <TrendingUp className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="font-fraunces text-xl font-bold text-foreground">
            {formatBRL(totalHoje)}
          </div>
          <Variacao atual={totalHoje} anterior={totalOntem} />
        </div>

        {/* Ticket mÃ©dio */}
        <div className="rounded-xl border border-border bg-white p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Ticket mÃ©dio
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <DollarSign className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="font-fraunces text-xl font-bold text-foreground">
            {vendasHoje > 0 ? formatBRL(ticketMedio) : "â€”"}
          </div>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {produtosAtivos} produto{produtosAtivos !== 1 ? "s" : ""} ativos
          </span>
        </div>

        {/* Estoque negativo */}
        <div
          className={`rounded-xl border bg-white p-3 ${estoqueNegativo.length > 0 ? "border-red-200" : "border-border"}`}
        >
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Estoque negativo
            </span>
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                estoqueNegativo.length > 0
                  ? "bg-red-50 text-red-600"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <AlertOctagon className="h-3.5 w-3.5" />
            </div>
          </div>
          <div
            className={`font-fraunces text-xl font-bold ${estoqueNegativo.length > 0 ? "text-red-600" : "text-foreground"}`}
          >
            {estoqueNegativo.length}
          </div>
          {estoqueNegativo.length > 0 ? (
            <Link
              href="/estoque?negativo=1"
              className="mt-0.5 block text-xs text-red-600 hover:underline"
            >
              Recontar â†’
            </Link>
          ) : (
            <span className="mt-0.5 block text-xs text-muted-foreground">tudo ok</span>
          )}
        </div>
      </div>

      {/* Linha 2: Ãšltimas vendas + Por mÃ©todo */}
      <div className="grid grid-cols-1 gap-3 desk:grid-cols-5">
        {/* Ãšltimas vendas */}
        <div className="rounded-xl border border-border bg-white desk:col-span-3">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <h2 className="text-sm font-semibold">Ãšltimas vendas</h2>
            <Link href="/vendas/historico" className="text-xs text-verde-mata hover:underline">
              Ver todas â†’
            </Link>
          </div>
          <div className="divide-y divide-border">
            {ultimasVendas.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                Nenhuma venda registrada.
              </p>
            ) : (
              ultimasVendas.map((venda) => (
                <div key={venda.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-foreground">
                      Venda #{venda.numero}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      por {venda.usuario.nome}
                    </span>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-3">
                    <span className="hidden text-xs text-muted-foreground desk:block">
                      {formatDataHora(venda.createdAt)}
                    </span>
                    <span className="text-sm font-semibold text-verde-mata">
                      {formatBRL(Number(venda.total))}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Por mÃ©todo de pagamento */}
        <div className="rounded-xl border border-border bg-white p-4 desk:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">Pagamentos hoje</h2>
          {porMetodo.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum pagamento ainda.</p>
          ) : (
            <div className="space-y-2.5">
              {(() => {
                const totalMetodos = porMetodo.reduce(
                  (acc, m) => acc + Number(m._sum.valor ?? 0),
                  0
                );
                return porMetodo.map((m) => {
                  const val = Number(m._sum.valor ?? 0);
                  const pct = totalMetodos > 0 ? (val / totalMetodos) * 100 : 0;
                  return (
                    <div key={m.metodo}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {METODO_LABEL[m.metodo] ?? m.metodo}
                        </span>
                        <span className="font-semibold text-verde-mata">{formatBRL(val)}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-verde-claro transition-all"
                          style={{ width: `${pct.toFixed(1)}%` }}
                        />
                      </div>
                    </div>
                  );
                });
              })()}
              <div className="flex justify-between border-t border-border pt-2 text-sm">
                <span className="font-medium text-muted-foreground">Total</span>
                <span className="font-bold text-foreground">
                  {formatBRL(porMetodo.reduce((acc, m) => acc + Number(m._sum.valor ?? 0), 0))}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Linha 3: Top produtos + Estoque crÃ­tico */}
      {(topProdutos.length > 0 || estoqueCritico.length > 0) && (
        <div className="grid grid-cols-1 gap-3 desk:grid-cols-5">
          {/* Top produtos */}
          {topProdutos.length > 0 && (
            <div className="rounded-xl border border-border bg-white desk:col-span-3">
              <div className="border-b border-border px-4 py-2.5">
                <h2 className="text-sm font-semibold">Mais vendidos hoje</h2>
              </div>
              <div className="divide-y divide-border">
                {topProdutos.map((p, i) => (
                  <div key={p.nome} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-5 flex-shrink-0 text-center font-fraunces text-base font-bold text-muted-foreground/40">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{p.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        Qtd: {Number(p.qtd).toFixed(2)}
                      </p>
                    </div>
                    <span className="flex-shrink-0 text-sm font-semibold text-verde-mata">
                      {formatBRL(Number(p.total_val))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Estoque crÃ­tico */}
          {estoqueCritico.length > 0 && (
            <div
              className={`rounded-xl border border-yellow-200 bg-white ${topProdutos.length > 0 ? "desk:col-span-2" : "desk:col-span-5"}`}
            >
              <div className="flex items-center justify-between border-b border-yellow-100 px-4 py-2.5">
                <h2 className="text-sm font-semibold text-yellow-700">Estoque crÃ­tico</h2>
                <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">
                  {estoqueCritico.length}
                </span>
              </div>
              <div className="divide-y divide-border">
                {estoqueCritico.map((p) => {
                  const pct =
                    Number(p.quantidadeMinima) > 0
                      ? Math.round((Number(p.quantidade) / Number(p.quantidadeMinima)) * 100)
                      : 0;
                  return (
                    <div key={p.id} className="px-4 py-2.5">
                      <div className="mb-1 flex items-center justify-between">
                        <Link
                          href={`/estoque/${p.id}`}
                          className="max-w-[60%] truncate text-sm font-medium hover:underline"
                        >
                          {p.nome}
                        </Link>
                        <span className="ml-2 flex-shrink-0 text-xs font-semibold text-yellow-700">
                          {Number(p.quantidade).toFixed(2)} /{" "}
                          {Number(p.quantidadeMinima).toFixed(2)}{" "}
                          {UNIDADE_LABEL[p.unidade] ?? p.unidade}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${pct <= 0 ? "bg-red-500" : pct < 50 ? "bg-orange-400" : "bg-yellow-400"}`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Linha 4: Estoque negativo */}
      {estoqueNegativo.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50">
          <div className="flex items-center justify-between border-b border-red-100 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <AlertOctagon className="h-4 w-4 text-red-600" />
              <h2 className="text-sm font-semibold text-red-700">Estoque negativo â€” recontar</h2>
            </div>
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
              {estoqueNegativo.length} produto{estoqueNegativo.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="divide-y divide-red-100">
            {estoqueNegativo.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
                <Link
                  href={`/estoque/${p.id}`}
                  className="max-w-[60%] truncate text-sm font-medium text-red-800 hover:underline"
                >
                  {p.nome}
                </Link>
                <span className="ml-2 flex-shrink-0 text-sm font-bold text-red-600">
                  {Number(p.quantidade).toFixed(2)} {UNIDADE_LABEL[p.unidade] ?? p.unidade}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Atalhos rÃ¡pidos */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { href: "/vendas", label: "Nova venda", desc: "Abrir PDV" },
          { href: "/estoque/novo", label: "Novo produto", desc: "Cadastrar no estoque" },
          { href: "/notas", label: "Notas e recibos", desc: "Ver documentos" },
          { href: "/relatorios", label: "RelatÃ³rios", desc: "Indicadores do dia" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-xl border border-border bg-white p-3 transition-all hover:border-verde-claro/50 hover:shadow-sm"
          >
            <p className="text-sm font-semibold">{item.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{item.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
