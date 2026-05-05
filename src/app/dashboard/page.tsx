export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AppLayout } from "@/components/app/app-layout";
import { prisma } from "@/lib/prisma";
import { formatBRL, formatData, formatDataHora } from "@/lib/format";
import {
  ShoppingCart, TrendingUp, Package, AlertTriangle,
  DollarSign, ArrowUp, ArrowDown, Minus,
} from "lucide-react";
import Link from "next/link";

async function getDashboardData() {
  const now = new Date();
  const inicioHoje = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const fimHoje = new Date(inicioHoje.getTime() + 86400000);
  const inicioOntem = new Date(inicioHoje.getTime() - 86400000);

  const [
    vendasHoje, totalHojeAgg,
    vendasOntem, totalOntemAgg,
    ultimasVendas, produtosAtivos,
    porMetodo, topProdutos, estoqueCritico,
  ] = await Promise.all([
    prisma.venda.count({ where: { createdAt: { gte: inicioHoje, lt: fimHoje }, status: "CONCLUIDA" } }),
    prisma.venda.aggregate({ where: { createdAt: { gte: inicioHoje, lt: fimHoje }, status: "CONCLUIDA" }, _sum: { total: true } }),
    prisma.venda.count({ where: { createdAt: { gte: inicioOntem, lt: inicioHoje }, status: "CONCLUIDA" } }),
    prisma.venda.aggregate({ where: { createdAt: { gte: inicioOntem, lt: inicioHoje }, status: "CONCLUIDA" }, _sum: { total: true } }),
    prisma.venda.findMany({
      where: { status: "CONCLUIDA" },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, numero: true, total: true, createdAt: true, usuario: { select: { nome: true } } },
    }),
    prisma.produto.count({ where: { ativo: true, deletedAt: null } }),
    prisma.pagamento.groupBy({
      by: ["metodo"],
      where: { venda: { createdAt: { gte: inicioHoje, lt: fimHoje }, status: "CONCLUIDA" } },
      _sum: { valor: true },
      orderBy: { _sum: { valor: "desc" } },
    }),
    prisma.$queryRaw<{ nome: string; qtd: string; total_val: string }[]>`
      SELECT iv."nomeProduto" as nome,
             SUM(iv.quantidade::numeric)::text as qtd,
             SUM(iv.total::numeric)::text as total_val
      FROM "ItemVenda" iv
      JOIN "Venda" v ON v.id = iv."vendaId"
      WHERE v."createdAt" >= ${inicioHoje} AND v."createdAt" < ${fimHoje}
        AND v.status = 'CONCLUIDA'
      GROUP BY iv."nomeProduto"
      ORDER BY SUM(iv.quantidade::numeric) DESC
      LIMIT 5
    `,
    prisma.$queryRaw<{ id: string; nome: string; quantidade: string; quantidadeMinima: string; unidade: string }[]>`
      SELECT id, nome, quantidade::text, "quantidadeMinima"::text, unidade::text
      FROM "Produto"
      WHERE ativo = true AND "deletedAt" IS NULL
        AND "quantidadeMinima" > 0
        AND quantidade <= "quantidadeMinima"
      ORDER BY (quantidade / NULLIF("quantidadeMinima", 0)) ASC
      LIMIT 8
    `,
  ]);

  const totalHoje = Number(totalHojeAgg._sum.total ?? 0);
  const totalOntem = Number(totalOntemAgg._sum.total ?? 0);
  const ticketMedio = vendasHoje > 0 ? totalHoje / vendasHoje : 0;

  return {
    vendasHoje, vendasOntem,
    totalHoje, totalOntem,
    ticketMedio,
    ultimasVendas,
    produtosAtivos,
    porMetodo,
    topProdutos,
    estoqueCritico,
  };
}

const METODO_LABEL: Record<string, string> = {
  DINHEIRO: "Dinheiro", DEBITO: "Débito", CREDITO: "Crédito", PIX: "PIX",
};
const UNIDADE_LABEL: Record<string, string> = {
  UN: "un", KG: "kg", L: "L", SACO: "saco", CX: "cx", M: "m",
};

function Variacao({ atual, anterior }: { atual: number; anterior: number }) {
  if (anterior === 0) return <span className="text-xs text-muted-foreground mt-1">primeiro registro</span>;
  const pct = Math.round(((atual - anterior) / anterior) * 100);
  if (pct === 0) return (
    <span className="text-xs text-muted-foreground mt-1 flex items-center gap-0.5">
      <Minus className="w-3 h-3" /> igual a ontem
    </span>
  );
  const positivo = pct > 0;
  return (
    <span className={`text-xs mt-1 flex items-center gap-0.5 ${positivo ? "text-emerald-600" : "text-red-500"}`}>
      {positivo ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
      {Math.abs(pct)}% vs ontem
    </span>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-7 w-28 bg-muted rounded-lg animate-pulse" />
        <div className="h-4 w-56 bg-muted rounded animate-pulse mt-1.5" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="h-3 w-20 bg-muted rounded animate-pulse" />
              <div className="w-8 h-8 bg-muted rounded-lg animate-pulse" />
            </div>
            <div className="h-8 w-20 bg-muted rounded animate-pulse" />
            <div className="h-3 w-24 bg-muted rounded animate-pulse mt-1.5" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 bg-white rounded-xl border border-border">
          <div className="px-5 py-4 border-b border-border"><div className="h-4 w-24 bg-muted rounded animate-pulse" /></div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-5 py-3 flex items-center justify-between border-b border-border last:border-0">
              <div className="h-4 w-32 bg-muted rounded animate-pulse" />
              <div className="h-4 w-20 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
        <div className="lg:col-span-2 bg-white rounded-xl border border-border p-5">
          <div className="h-4 w-24 bg-muted rounded animate-pulse mb-4" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-2">
              <div className="h-4 w-16 bg-muted rounded animate-pulse" />
              <div className="h-4 w-20 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

async function DashboardContent() {
  const {
    vendasHoje, vendasOntem,
    totalHoje, totalOntem,
    ticketMedio,
    ultimasVendas,
    produtosAtivos,
    porMetodo,
    topProdutos,
    estoqueCritico,
  } = await getDashboardData();

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="font-fraunces text-2xl font-bold text-verde-mata">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {formatData(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy")}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Vendas hoje */}
        <div className="bg-white rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Vendas hoje</span>
            <div className="w-8 h-8 rounded-lg bg-verde-mata/10 text-verde-mata flex items-center justify-center">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div className="font-fraunces text-2xl font-bold text-foreground">{vendasHoje}</div>
          <Variacao atual={vendasHoje} anterior={vendasOntem} />
        </div>

        {/* Faturamento */}
        <div className="bg-white rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Faturamento</span>
            <div className="w-8 h-8 rounded-lg bg-terra/10 text-terra flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="font-fraunces text-2xl font-bold text-foreground">{formatBRL(totalHoje)}</div>
          <Variacao atual={totalHoje} anterior={totalOntem} />
        </div>

        {/* Ticket médio */}
        <div className="bg-white rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ticket médio</span>
            <div className="w-8 h-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="font-fraunces text-2xl font-bold text-foreground">
            {vendasHoje > 0 ? formatBRL(ticketMedio) : "—"}
          </div>
          <span className="text-xs text-muted-foreground mt-1 block">
            {produtosAtivos} produto{produtosAtivos !== 1 ? "s" : ""} ativos
          </span>
        </div>

        {/* Estoque crítico */}
        <div className={`bg-white rounded-xl border p-5 ${estoqueCritico.length > 0 ? "border-yellow-200" : "border-border"}`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Estoque baixo</span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              estoqueCritico.length > 0 ? "bg-yellow-50 text-yellow-600" : "bg-muted text-muted-foreground"
            }`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className={`font-fraunces text-2xl font-bold ${estoqueCritico.length > 0 ? "text-yellow-600" : "text-foreground"}`}>
            {estoqueCritico.length}
          </div>
          {estoqueCritico.length > 0 ? (
            <Link href="/relatorios" className="text-xs text-yellow-600 hover:underline mt-1 block">
              Ver detalhes →
            </Link>
          ) : (
            <span className="text-xs text-muted-foreground mt-1 block">tudo ok</span>
          )}
        </div>
      </div>

      {/* Linha 2: Últimas vendas + Por método */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Últimas vendas */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-border">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-sm">Últimas vendas</h2>
            <Link href="/vendas/historico" className="text-xs text-verde-mata hover:underline">
              Ver todas →
            </Link>
          </div>
          <div className="divide-y divide-border">
            {ultimasVendas.length === 0 ? (
              <p className="px-5 py-8 text-sm text-muted-foreground text-center">Nenhuma venda registrada.</p>
            ) : (
              ultimasVendas.map((venda) => (
                <div key={venda.id} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-foreground">Venda #{venda.numero}</span>
                    <span className="ml-2 text-xs text-muted-foreground">por {venda.usuario.nome}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-muted-foreground hidden sm:block">
                      {formatDataHora(venda.createdAt)}
                    </span>
                    <span className="text-sm font-semibold text-verde-mata">{formatBRL(Number(venda.total))}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Por método de pagamento */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-border p-5">
          <h2 className="font-semibold text-sm mb-4">Pagamentos hoje</h2>
          {porMetodo.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum pagamento ainda.</p>
          ) : (
            <div className="space-y-3">
              {(() => {
                const totalMetodos = porMetodo.reduce((acc, m) => acc + Number(m._sum.valor ?? 0), 0);
                return porMetodo.map((m) => {
                  const val = Number(m._sum.valor ?? 0);
                  const pct = totalMetodos > 0 ? (val / totalMetodos) * 100 : 0;
                  return (
                    <div key={m.metodo}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-muted-foreground">{METODO_LABEL[m.metodo] ?? m.metodo}</span>
                        <span className="font-semibold text-verde-mata">{formatBRL(val)}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-verde-claro rounded-full transition-all"
                          style={{ width: `${pct.toFixed(1)}%` }}
                        />
                      </div>
                    </div>
                  );
                });
              })()}
              <div className="pt-2 border-t border-border flex justify-between text-sm">
                <span className="text-muted-foreground font-medium">Total</span>
                <span className="font-bold text-foreground">
                  {formatBRL(porMetodo.reduce((acc, m) => acc + Number(m._sum.valor ?? 0), 0))}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Linha 3: Top produtos + Estoque crítico */}
      {(topProdutos.length > 0 || estoqueCritico.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* Top produtos */}
          {topProdutos.length > 0 && (
            <div className="lg:col-span-3 bg-white rounded-xl border border-border">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="font-semibold text-sm">Mais vendidos hoje</h2>
              </div>
              <div className="divide-y divide-border">
                {topProdutos.map((p, i) => (
                  <div key={p.nome} className="px-5 py-3 flex items-center gap-4">
                    <span className="text-lg font-fraunces font-bold text-muted-foreground/40 w-6 text-center">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{p.nome}</p>
                      <p className="text-xs text-muted-foreground">Qtd: {Number(p.qtd).toFixed(2)}</p>
                    </div>
                    <span className="text-sm font-semibold text-verde-mata flex-shrink-0">
                      {formatBRL(Number(p.total_val))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Estoque crítico */}
          {estoqueCritico.length > 0 && (
            <div className={`bg-white rounded-xl border border-yellow-200 ${topProdutos.length > 0 ? "lg:col-span-2" : "lg:col-span-5"}`}>
              <div className="px-5 py-4 border-b border-yellow-100 flex items-center justify-between">
                <h2 className="font-semibold text-sm text-yellow-700">Estoque crítico</h2>
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                  {estoqueCritico.length}
                </span>
              </div>
              <div className="divide-y divide-border">
                {estoqueCritico.map((p) => {
                  const pct = Number(p.quantidadeMinima) > 0
                    ? Math.round((Number(p.quantidade) / Number(p.quantidadeMinima)) * 100)
                    : 0;
                  return (
                    <div key={p.id} className="px-5 py-3">
                      <div className="flex items-center justify-between mb-1">
                        <Link href={`/estoque/${p.id}`} className="text-sm font-medium hover:underline truncate max-w-[60%]">
                          {p.nome}
                        </Link>
                        <span className="text-xs text-yellow-700 font-semibold flex-shrink-0 ml-2">
                          {Number(p.quantidade).toFixed(2)} / {Number(p.quantidadeMinima).toFixed(2)} {UNIDADE_LABEL[p.unidade] ?? p.unidade}
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
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

      {/* Atalhos rápidos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { href: "/vendas", label: "Nova venda", desc: "Abrir PDV" },
          { href: "/estoque/novo", label: "Novo produto", desc: "Cadastrar no estoque" },
          { href: "/notas", label: "Notas e recibos", desc: "Ver documentos" },
          { href: "/relatorios", label: "Relatórios", desc: "Indicadores do dia" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="bg-white rounded-xl border border-border p-4 hover:border-verde-claro/50 hover:shadow-sm transition-all"
          >
            <p className="text-sm font-semibold">{item.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  return (
    <AppLayout>
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </AppLayout>
  );
}
