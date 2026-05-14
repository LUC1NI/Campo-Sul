export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AppLayout } from "@/components/app/app-layout";
import { prisma } from "@/lib/prisma";
import { formatBRL, formatData } from "@/lib/format";
import Link from "next/link";
import {
  BarChart3, Package, TrendingUp, ShoppingCart,
  DollarSign, AlertTriangle, ArrowUp, ArrowDown, Minus,
  FileText, History,
} from "lucide-react";

type Periodo = "hoje" | "semana" | "mes";

const PERIODOS: { key: Periodo; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "semana", label: "Esta semana" },
  { key: "mes", label: "Este mês" },
];

const METODO_LABEL: Record<string, string> = {
  DINHEIRO: "Dinheiro", DEBITO: "Débito", CREDITO: "Crédito", PIX: "PIX",
};

const METODO_BAR: Record<string, string> = {
  DINHEIRO: "bg-emerald-500",
  PIX: "bg-blue-500",
  DEBITO: "bg-violet-500",
  CREDITO: "bg-amber-500",
};

const UNIDADE_LABEL: Record<string, string> = {
  UN: "un", KG: "kg", L: "L", SACO: "saco", CX: "cx", M: "m",
};

function getIntervalo(periodo: Periodo) {
  const now = new Date();
  const inicioHoje = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const fimHoje = new Date(inicioHoje.getTime() + 86400000);

  if (periodo === "semana") {
    const dow = inicioHoje.getDay();
    const diffLun = dow === 0 ? 6 : dow - 1;
    const inicioSemana = new Date(inicioHoje.getTime() - diffLun * 86400000);
    const inicioSemanaAnt = new Date(inicioSemana.getTime() - 7 * 86400000);
    return {
      inicio: inicioSemana, fim: fimHoje,
      inicioAnt: inicioSemanaAnt, fimAnt: inicioSemana,
      labelAnt: "semana passada",
    };
  }

  if (periodo === "mes") {
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);
    const inicioMesAnt = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return {
      inicio: inicioMes, fim: fimHoje,
      inicioAnt: inicioMesAnt, fimAnt: inicioMes,
      labelAnt: "mês passado",
    };
  }

  const inicioOntem = new Date(inicioHoje.getTime() - 86400000);
  return {
    inicio: inicioHoje, fim: fimHoje,
    inicioAnt: inicioOntem, fimAnt: inicioHoje,
    labelAnt: "ontem",
  };
}

async function getData(periodo: Periodo) {
  const { inicio, fim, inicioAnt, fimAnt } = getIntervalo(periodo);

  const [
    vendas, totalAgg,
    vendasAnt, totalAntAgg,
    porMetodo, topProdutos, produtosBaixos,
  ] = await Promise.all([
    prisma.venda.count({ where: { createdAt: { gte: inicio, lt: fim }, status: "CONCLUIDA" } }),
    prisma.venda.aggregate({ where: { createdAt: { gte: inicio, lt: fim }, status: "CONCLUIDA" }, _sum: { total: true } }),
    prisma.venda.count({ where: { createdAt: { gte: inicioAnt, lt: fimAnt }, status: "CONCLUIDA" } }),
    prisma.venda.aggregate({ where: { createdAt: { gte: inicioAnt, lt: fimAnt }, status: "CONCLUIDA" }, _sum: { total: true } }),
    prisma.pagamento.groupBy({
      by: ["metodo"],
      where: { venda: { createdAt: { gte: inicio, lt: fim }, status: "CONCLUIDA" } },
      _sum: { valor: true },
      orderBy: { _sum: { valor: "desc" } },
    }),
    prisma.itemVenda.groupBy({
      by: ["nomeProduto"],
      where: { venda: { createdAt: { gte: inicio, lt: fim }, status: "CONCLUIDA" } },
      _sum: { quantidade: true, total: true },
      orderBy: { _sum: { total: "desc" } },
      take: 8,
    }),
    prisma.produto.findMany({
      where: { ativo: true, deletedAt: null, quantidadeMinima: { gt: 0 } },
      select: { id: true, nome: true, quantidade: true, quantidadeMinima: true, unidade: true },
      orderBy: { nome: "asc" },
      take: 100,
    }),
  ]);

  const topProdutosNorm = topProdutos.map((p) => ({
    nome: p.nomeProduto,
    qtd: String(p._sum.quantidade ?? 0),
    total_val: String(p._sum.total ?? 0),
  }));

  const produtosBaixosNorm = produtosBaixos
    .filter((p) => Number(p.quantidade) <= Number(p.quantidadeMinima))
    .sort((a, b) => {
      const ra = Number(a.quantidade) / (Number(a.quantidadeMinima) || 1);
      const rb = Number(b.quantidade) / (Number(b.quantidadeMinima) || 1);
      return ra - rb;
    })
    .slice(0, 20)
    .map((p) => ({
      id: p.id,
      nome: p.nome,
      quantidade: String(p.quantidade),
      quantidadeMinima: String(p.quantidadeMinima),
      unidade: String(p.unidade),
    }));

  return {
    vendas, total: Number(totalAgg._sum.total ?? 0),
    vendasAnt, totalAnt: Number(totalAntAgg._sum.total ?? 0),
    porMetodo,
    topProdutos: topProdutosNorm,
    produtosBaixos: produtosBaixosNorm,
  };
}

function Variacao({ atual, anterior, labelAnt }: { atual: number; anterior: number; labelAnt: string }) {
  if (anterior === 0) {
    return <span className="text-xs text-muted-foreground mt-1 block">primeiro registro</span>;
  }
  const pct = Math.round(((atual - anterior) / anterior) * 100);
  if (pct === 0) {
    return (
      <span className="text-xs text-muted-foreground mt-1 flex items-center gap-0.5">
        <Minus className="w-3 h-3" /> igual a {labelAnt}
      </span>
    );
  }
  const positivo = pct > 0;
  return (
    <span className={`text-xs mt-1 flex items-center gap-0.5 ${positivo ? "text-emerald-600" : "text-red-500"}`}>
      {positivo ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
      {Math.abs(pct)}% vs {labelAnt}
    </span>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <div className="h-6 w-32 bg-muted rounded-lg animate-pulse" />
          <div className="h-3.5 w-52 bg-muted rounded animate-pulse mt-1" />
        </div>
        <div className="h-8 w-56 bg-muted rounded-lg animate-pulse" />
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
          <div className="px-4 py-3 border-b border-border"><div className="h-4 w-28 bg-muted rounded animate-pulse" /></div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-4 py-2.5 flex items-center gap-3">
              <div className="w-5 h-4 bg-muted rounded animate-pulse" />
              <div className="flex-1"><div className="h-4 w-36 bg-muted rounded animate-pulse" /></div>
              <div className="h-4 w-20 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
        <div className="desk:col-span-2 bg-white rounded-xl border border-border p-4">
          <div className="h-4 w-24 bg-muted rounded animate-pulse mb-3" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="mb-2.5">
              <div className="flex justify-between mb-1">
                <div className="h-4 w-16 bg-muted rounded animate-pulse" />
                <div className="h-4 w-20 bg-muted rounded animate-pulse" />
              </div>
              <div className="h-1.5 bg-muted rounded-full animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

async function Content({ periodo }: { periodo: Periodo }) {
  const { vendas, total, vendasAnt, totalAnt, porMetodo, topProdutos, produtosBaixos } = await getData(periodo);
  const ticket = vendas > 0 ? total / vendas : 0;
  const ticketAnt = vendasAnt > 0 ? totalAnt / vendasAnt : 0;
  const { labelAnt } = getIntervalo(periodo);
  const totalMetodos = porMetodo.reduce((acc, m) => acc + Number(m._sum.valor ?? 0), 0);

  return (
    <div className="space-y-3">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="font-fraunces text-lg font-bold text-verde-mata">Relatórios</h1>
          <p className="text-xs text-muted-foreground">
            {formatData(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy")}
          </p>
        </div>
        <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
          {PERIODOS.map(({ key, label }) => (
            <Link
              key={key}
              href={`/relatorios?periodo=${key}`}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                periodo === key
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 desk:grid-cols-4 gap-3">

        <div className="bg-white rounded-xl border border-border p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Vendas</span>
            <div className="w-7 h-7 rounded-lg bg-verde-mata/10 text-verde-mata flex items-center justify-center">
              <ShoppingCart className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="font-fraunces text-xl font-bold text-foreground">{vendas}</div>
          <Variacao atual={vendas} anterior={vendasAnt} labelAnt={labelAnt} />
        </div>

        <div className="bg-white rounded-xl border border-border p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Faturamento</span>
            <div className="w-7 h-7 rounded-lg bg-terra/10 text-terra flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="font-fraunces text-xl font-bold text-foreground">{formatBRL(total)}</div>
          <Variacao atual={total} anterior={totalAnt} labelAnt={labelAnt} />
        </div>

        <div className="bg-white rounded-xl border border-border p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ticket médio</span>
            <div className="w-7 h-7 rounded-lg bg-muted text-muted-foreground flex items-center justify-center">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="font-fraunces text-xl font-bold text-foreground">
            {vendas > 0 ? formatBRL(ticket) : "—"}
          </div>
          {ticketAnt > 0 ? (
            <Variacao atual={ticket} anterior={ticketAnt} labelAnt={labelAnt} />
          ) : (
            <span className="text-xs text-muted-foreground mt-0.5 block">por venda</span>
          )}
        </div>

        <div className={`bg-white rounded-xl border p-3 ${produtosBaixos.length > 0 ? "border-yellow-200" : "border-border"}`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Estoque baixo</span>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
              produtosBaixos.length > 0 ? "bg-yellow-50 text-yellow-600" : "bg-muted text-muted-foreground"
            }`}>
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className={`font-fraunces text-xl font-bold ${produtosBaixos.length > 0 ? "text-yellow-600" : "text-foreground"}`}>
            {produtosBaixos.length}
          </div>
          {produtosBaixos.length > 0 ? (
            <span className="text-xs text-yellow-600 mt-0.5 block">abaixo do mínimo</span>
          ) : (
            <span className="text-xs text-muted-foreground mt-0.5 block">tudo ok</span>
          )}
        </div>
      </div>

      {/* Top produtos + Pagamentos */}
      <div className="grid grid-cols-1 desk:grid-cols-5 gap-3">

        <div className="desk:col-span-3 bg-white rounded-xl border border-border">
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-semibold text-sm">Mais vendidos</h2>
            </div>
            <Link href="/estoque" className="text-xs text-verde-mata hover:underline">
              Ver estoque →
            </Link>
          </div>
          {topProdutos.length === 0 ? (
            <p className="px-4 py-8 text-sm text-muted-foreground text-center">Nenhuma venda no período.</p>
          ) : (
            <div className="divide-y divide-border">
              {topProdutos.map((p, i) => {
                const maxVal = Number(topProdutos[0].total_val);
                const pct = maxVal > 0 ? (Number(p.total_val) / maxVal) * 100 : 0;
                return (
                  <div key={p.nome} className="px-4 py-2.5 flex items-center gap-3">
                    <span className="text-sm font-fraunces font-bold text-muted-foreground/40 w-5 text-right flex-shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{p.nome}</p>
                      <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-verde-claro rounded-full" style={{ width: `${pct.toFixed(1)}%` }} />
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-verde-mata">{formatBRL(Number(p.total_val))}</p>
                      <p className="text-xs text-muted-foreground">qtd {Number(p.qtd).toFixed(2)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="desk:col-span-2 bg-white rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm">Pagamentos</h2>
          </div>
          {porMetodo.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum pagamento no período.</p>
          ) : (
            <div className="space-y-2.5">
              {porMetodo.map((m) => {
                const val = Number(m._sum.valor ?? 0);
                const pct = totalMetodos > 0 ? (val / totalMetodos) * 100 : 0;
                const barColor = METODO_BAR[m.metodo] ?? "bg-verde-claro";
                return (
                  <div key={m.metodo}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-muted-foreground">{METODO_LABEL[m.metodo] ?? m.metodo}</span>
                      <div className="text-right">
                        <span className="font-semibold text-foreground">{formatBRL(val)}</span>
                        <span className="text-xs text-muted-foreground ml-1">{pct.toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct.toFixed(1)}%` }} />
                    </div>
                  </div>
                );
              })}
              <div className="pt-2 border-t border-border flex justify-between items-center">
                <span className="text-sm text-muted-foreground font-medium">Total</span>
                <span className="text-sm font-bold text-foreground">{formatBRL(totalMetodos)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Estoque baixo */}
      {produtosBaixos.length > 0 && (
        <div className="bg-white rounded-xl border border-yellow-200">
          <div className="px-4 py-2.5 border-b border-yellow-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
              <h2 className="font-semibold text-sm text-yellow-700">Estoque abaixo do mínimo</h2>
            </div>
            <span className="text-xs bg-yellow-100 text-yellow-700 font-semibold px-2 py-0.5 rounded-full">
              {produtosBaixos.length}
            </span>
          </div>
          <div className="divide-y divide-border">
            {produtosBaixos.map((p) => {
              const pct = Number(p.quantidadeMinima) > 0
                ? Math.round((Number(p.quantidade) / Number(p.quantidadeMinima)) * 100)
                : 0;
              const uni = UNIDADE_LABEL[p.unidade] ?? p.unidade;
              return (
                <div key={p.id} className="px-4 py-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <Link href={`/estoque/${p.id}`} className="text-sm font-medium hover:underline text-foreground truncate max-w-[55%]">
                      {p.nome}
                    </Link>
                    <span className="text-xs flex-shrink-0 ml-2">
                      <span className={`font-semibold ${pct <= 0 ? "text-red-600" : "text-yellow-700"}`}>
                        {Number(p.quantidade).toFixed(2)} {uni}
                      </span>
                      <span className="text-muted-foreground"> / mín {Number(p.quantidadeMinima).toFixed(2)} {uni}</span>
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${pct <= 0 ? "bg-red-500" : pct < 50 ? "bg-orange-400" : "bg-yellow-400"}`}
                      style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Atalhos */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {[
          { href: "/vendas/historico", Icon: History, label: "Histórico de vendas", desc: "Ver todas as vendas realizadas" },
          { href: "/notas", Icon: FileText, label: "Notas e recibos", desc: "Documentos emitidos" },
          { href: "/estoque", Icon: Package, label: "Estoque", desc: "Gerenciar produtos e quantidades" },
        ].map(({ href, Icon, label, desc }) => (
          <Link
            key={href}
            href={href}
            className="bg-white rounded-xl border border-border p-3 hover:border-verde-claro/50 hover:shadow-sm transition-all flex items-start gap-3"
          >
            <Icon className="w-4 h-4 text-verde-mata mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold">{label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
            </div>
          </Link>
        ))}
      </div>

    </div>
  );
}

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const { periodo: periodoParam } = await searchParams;
  const periodo = (["hoje", "semana", "mes"].includes(periodoParam ?? "") ? periodoParam : "hoje") as Periodo;

  return (
    <AppLayout>
      <Suspense fallback={<Skeleton />}>
        <Content periodo={periodo} />
      </Suspense>
    </AppLayout>
  );
}
