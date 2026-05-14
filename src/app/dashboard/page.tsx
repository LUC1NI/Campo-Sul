export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AppLayout } from "@/components/app/app-layout";
import { prisma } from "@/lib/prisma";
import { formatBRL, formatData, formatDataHora } from "@/lib/format";
import {
  ShoppingCart, TrendingUp, AlertOctagon,
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
    porMetodo, topProdutos, estoqueCritico, estoqueNegativo,
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

  // Filtra em JS os que estão abaixo do mínimo (coluna-a-coluna não suportado pelo ORM)
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
    vendasHoje, vendasOntem,
    totalHoje, totalOntem,
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
    <div className="space-y-3">
      <div>
        <div className="h-6 w-28 bg-muted rounded-lg animate-pulse" />
        <div className="h-3.5 w-56 bg-muted rounded animate-pulse mt-1" />
      </div>
      <div className="grid grid-cols-2 desk:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-border p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="h-3 w-20 bg-muted rounded animate-pulse" />
              <div className="w-7 h-7 bg-muted rounded-lg animate-pulse" />
            </div>
            <div className="h-6 w-20 bg-muted rounded animate-pulse" />
            <div className="h-3 w-24 bg-muted rounded animate-pulse mt-1" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 desk:grid-cols-5 gap-3">
        <div className="desk:col-span-3 bg-white rounded-xl border border-border">
          <div className="px-4 py-3 border-b border-border"><div className="h-4 w-24 bg-muted rounded animate-pulse" /></div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-4 py-2.5 flex items-center justify-between border-b border-border last:border-0">
              <div className="h-4 w-32 bg-muted rounded animate-pulse" />
              <div className="h-4 w-20 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
        <div className="desk:col-span-2 bg-white rounded-xl border border-border p-4">
          <div className="h-4 w-24 bg-muted rounded animate-pulse mb-3" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-1.5">
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
    estoqueNegativo,
  } = await getDashboardData();

  return (
    <div className="space-y-3">
      {/* Cabeçalho */}
      <div>
        <h1 className="font-fraunces text-lg font-bold text-verde-mata">Dashboard</h1>
        <p className="text-xs text-muted-foreground">
          {formatData(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy")}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 desk:grid-cols-4 gap-3">

        {/* Vendas hoje */}
        <div className="bg-white rounded-xl border border-border p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Vendas hoje</span>
            <div className="w-7 h-7 rounded-lg bg-verde-mata/10 text-verde-mata flex items-center justify-center">
              <ShoppingCart className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="font-fraunces text-xl font-bold text-foreground">{vendasHoje}</div>
          <Variacao atual={vendasHoje} anterior={vendasOntem} />
        </div>

        {/* Faturamento */}
        <div className="bg-white rounded-xl border border-border p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Faturamento</span>
            <div className="w-7 h-7 rounded-lg bg-terra/10 text-terra flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="font-fraunces text-xl font-bold text-foreground">{formatBRL(totalHoje)}</div>
          <Variacao atual={totalHoje} anterior={totalOntem} />
        </div>

        {/* Ticket médio */}
        <div className="bg-white rounded-xl border border-border p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ticket médio</span>
            <div className="w-7 h-7 rounded-lg bg-muted text-muted-foreground flex items-center justify-center">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="font-fraunces text-xl font-bold text-foreground">
            {vendasHoje > 0 ? formatBRL(ticketMedio) : "—"}
          </div>
          <span className="text-xs text-muted-foreground mt-0.5 block">
            {produtosAtivos} produto{produtosAtivos !== 1 ? "s" : ""} ativos
          </span>
        </div>

        {/* Estoque negativo */}
        <div className={`bg-white rounded-xl border p-3 ${estoqueNegativo.length > 0 ? "border-red-200" : "border-border"}`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Estoque negativo</span>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
              estoqueNegativo.length > 0 ? "bg-red-50 text-red-600" : "bg-muted text-muted-foreground"
            }`}>
              <AlertOctagon className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className={`font-fraunces text-xl font-bold ${estoqueNegativo.length > 0 ? "text-red-600" : "text-foreground"}`}>
            {estoqueNegativo.length}
          </div>
          {estoqueNegativo.length > 0 ? (
            <Link href="/estoque?negativo=1" className="text-xs text-red-600 hover:underline mt-0.5 block">
              Recontar →
            </Link>
          ) : (
            <span className="text-xs text-muted-foreground mt-0.5 block">tudo ok</span>
          )}
        </div>
      </div>

      {/* Linha 2: Últimas vendas + Por método */}
      <div className="grid grid-cols-1 desk:grid-cols-5 gap-3">

        {/* Últimas vendas */}
        <div className="desk:col-span-3 bg-white rounded-xl border border-border">
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-sm">Últimas vendas</h2>
            <Link href="/vendas/historico" className="text-xs text-verde-mata hover:underline">
              Ver todas →
            </Link>
          </div>
          <div className="divide-y divide-border">
            {ultimasVendas.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">Nenhuma venda registrada.</p>
            ) : (
              ultimasVendas.map((venda) => (
                <div key={venda.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-foreground">Venda #{venda.numero}</span>
                    <span className="ml-2 text-xs text-muted-foreground">por {venda.usuario.nome}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-muted-foreground hidden desk:block">
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
        <div className="desk:col-span-2 bg-white rounded-xl border border-border p-4">
          <h2 className="font-semibold text-sm mb-3">Pagamentos hoje</h2>
          {porMetodo.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum pagamento ainda.</p>
          ) : (
            <div className="space-y-2.5">
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
        <div className="grid grid-cols-1 desk:grid-cols-5 gap-3">

          {/* Top produtos */}
          {topProdutos.length > 0 && (
            <div className="desk:col-span-3 bg-white rounded-xl border border-border">
              <div className="px-4 py-2.5 border-b border-border">
                <h2 className="font-semibold text-sm">Mais vendidos hoje</h2>
              </div>
              <div className="divide-y divide-border">
                {topProdutos.map((p, i) => (
                  <div key={p.nome} className="px-4 py-2.5 flex items-center gap-3">
                    <span className="text-base font-fraunces font-bold text-muted-foreground/40 w-5 text-center flex-shrink-0">
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
            <div className={`bg-white rounded-xl border border-yellow-200 ${topProdutos.length > 0 ? "desk:col-span-2" : "desk:col-span-5"}`}>
              <div className="px-4 py-2.5 border-b border-yellow-100 flex items-center justify-between">
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
                    <div key={p.id} className="px-4 py-2.5">
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

      {/* Linha 4: Estoque negativo */}
      {estoqueNegativo.length > 0 && (
        <div className="bg-red-50 rounded-xl border border-red-200">
          <div className="px-4 py-2.5 border-b border-red-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-red-600" />
              <h2 className="font-semibold text-sm text-red-700">Estoque negativo — recontar</h2>
            </div>
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
              {estoqueNegativo.length} produto{estoqueNegativo.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="divide-y divide-red-100">
            {estoqueNegativo.map((p) => (
              <div key={p.id} className="px-4 py-2.5 flex items-center justify-between">
                <Link href={`/estoque/${p.id}`} className="text-sm font-medium text-red-800 hover:underline truncate max-w-[60%]">
                  {p.nome}
                </Link>
                <span className="text-sm font-bold text-red-600 flex-shrink-0 ml-2">
                  {Number(p.quantidade).toFixed(2)} {UNIDADE_LABEL[p.unidade] ?? p.unidade}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Atalhos rápidos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { href: "/vendas", label: "Nova venda", desc: "Abrir PDV" },
          { href: "/estoque/novo", label: "Novo produto", desc: "Cadastrar no estoque" },
          { href: "/notas", label: "Notas e recibos", desc: "Ver documentos" },
          { href: "/relatorios", label: "Relatórios", desc: "Indicadores do dia" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="bg-white rounded-xl border border-border p-3 hover:border-verde-claro/50 hover:shadow-sm transition-all"
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
