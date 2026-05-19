export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { formatBRL, formatData } from "@/lib/format";
import Link from "next/link";
import {
  BarChart3,
  Package,
  TrendingUp,
  ShoppingCart,
  DollarSign,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Minus,
  FileText,
  History,
} from "lucide-react";

type Periodo = "hoje" | "semana" | "mes";

const PERIODOS: { key: Periodo; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "semana", label: "Esta semana" },
  { key: "mes", label: "Este mês" },
];

const METODO_LABEL: Record<string, string> = {
  DINHEIRO: "Dinheiro",
  DEBITO: "Débito",
  CREDITO: "Crédito",
  PIX: "PIX",
};

const METODO_BAR: Record<string, string> = {
  DINHEIRO: "bg-emerald-500",
  PIX: "bg-blue-500",
  DEBITO: "bg-violet-500",
  CREDITO: "bg-amber-500",
};

const UNIDADE_LABEL: Record<string, string> = {
  UN: "un",
  KG: "kg",
  L: "L",
  SACO: "saco",
  CX: "cx",
  M: "m",
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
      inicio: inicioSemana,
      fim: fimHoje,
      inicioAnt: inicioSemanaAnt,
      fimAnt: inicioSemana,
      labelAnt: "semana passada",
    };
  }

  if (periodo === "mes") {
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);
    const inicioMesAnt = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return {
      inicio: inicioMes,
      fim: fimHoje,
      inicioAnt: inicioMesAnt,
      fimAnt: inicioMes,
      labelAnt: "mês passado",
    };
  }

  const inicioOntem = new Date(inicioHoje.getTime() - 86400000);
  return {
    inicio: inicioHoje,
    fim: fimHoje,
    inicioAnt: inicioOntem,
    fimAnt: inicioHoje,
    labelAnt: "ontem",
  };
}

async function getData(periodo: Periodo) {
  const { inicio, fim, inicioAnt, fimAnt } = getIntervalo(periodo);

  const [vendas, totalAgg, vendasAnt, totalAntAgg, porMetodo, topProdutos, produtosBaixos] =
    await Promise.all([
      prisma.venda.count({ where: { createdAt: { gte: inicio, lt: fim }, status: "CONCLUIDA" } }),
      prisma.venda.aggregate({
        where: { createdAt: { gte: inicio, lt: fim }, status: "CONCLUIDA" },
        _sum: { total: true },
      }),
      prisma.venda.count({
        where: { createdAt: { gte: inicioAnt, lt: fimAnt }, status: "CONCLUIDA" },
      }),
      prisma.venda.aggregate({
        where: { createdAt: { gte: inicioAnt, lt: fimAnt }, status: "CONCLUIDA" },
        _sum: { total: true },
      }),
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
    vendas,
    total: Number(totalAgg._sum.total ?? 0),
    vendasAnt,
    totalAnt: Number(totalAntAgg._sum.total ?? 0),
    porMetodo,
    topProdutos: topProdutosNorm,
    produtosBaixos: produtosBaixosNorm,
  };
}

function Variacao({
  atual,
  anterior,
  labelAnt,
}: {
  atual: number;
  anterior: number;
  labelAnt: string;
}) {
  if (anterior === 0) {
    return <span className="mt-1 block text-xs text-muted-foreground">primeiro registro</span>;
  }
  const pct = Math.round(((atual - anterior) / anterior) * 100);
  if (pct === 0) {
    return (
      <span className="mt-1 flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" /> igual a {labelAnt}
      </span>
    );
  }
  const positivo = pct > 0;
  return (
    <span
      className={`mt-1 flex items-center gap-0.5 text-xs ${positivo ? "text-emerald-600" : "text-red-500"}`}
    >
      {positivo ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {Math.abs(pct)}% vs {labelAnt}
    </span>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="h-6 w-32 animate-pulse rounded-lg bg-muted" />
          <div className="mt-1 h-3.5 w-52 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-8 w-56 animate-pulse rounded-lg bg-muted" />
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
            <div className="h-4 w-28 animate-pulse rounded bg-muted" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5">
              <div className="h-4 w-5 animate-pulse rounded bg-muted" />
              <div className="flex-1">
                <div className="h-4 w-36 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-border bg-white p-4 desk:col-span-2">
          <div className="mb-3 h-4 w-24 animate-pulse rounded bg-muted" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="mb-2.5">
              <div className="mb-1 flex justify-between">
                <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                <div className="h-4 w-20 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-1.5 animate-pulse rounded-full bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

async function Content({ periodo }: { periodo: Periodo }) {
  const { vendas, total, vendasAnt, totalAnt, porMetodo, topProdutos, produtosBaixos } =
    await getData(periodo);
  const ticket = vendas > 0 ? total / vendas : 0;
  const ticketAnt = vendasAnt > 0 ? totalAnt / vendasAnt : 0;
  const { labelAnt } = getIntervalo(periodo);
  const totalMetodos = porMetodo.reduce((acc, m) => acc + Number(m._sum.valor ?? 0), 0);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-fraunces text-lg font-bold text-verde-mata">Relatórios</h1>
          <p className="text-xs text-muted-foreground">
            {formatData(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy")}
          </p>
        </div>
        <div className="flex w-fit gap-1 rounded-lg bg-muted p-1">
          {PERIODOS.map(({ key, label }) => (
            <Link
              key={key}
              href={`/relatorios?periodo=${key}`}
              className={`whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all ${
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
      <div className="grid grid-cols-2 gap-3 desk:grid-cols-4">
        <div className="rounded-xl border border-border bg-white p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Vendas
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-verde-mata/10 text-verde-mata">
              <ShoppingCart className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="font-fraunces text-xl font-bold text-foreground">{vendas}</div>
          <Variacao atual={vendas} anterior={vendasAnt} labelAnt={labelAnt} />
        </div>

        <div className="rounded-xl border border-border bg-white p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Faturamento
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-terra/10 text-terra">
              <TrendingUp className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="font-fraunces text-xl font-bold text-foreground">{formatBRL(total)}</div>
          <Variacao atual={total} anterior={totalAnt} labelAnt={labelAnt} />
        </div>

        <div className="rounded-xl border border-border bg-white p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Ticket médio
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <DollarSign className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="font-fraunces text-xl font-bold text-foreground">
            {vendas > 0 ? formatBRL(ticket) : "�"}
          </div>
          {ticketAnt > 0 ? (
            <Variacao atual={ticket} anterior={ticketAnt} labelAnt={labelAnt} />
          ) : (
            <span className="mt-0.5 block text-xs text-muted-foreground">por venda</span>
          )}
        </div>

        <div
          className={`rounded-xl border bg-white p-3 ${produtosBaixos.length > 0 ? "border-yellow-200" : "border-border"}`}
        >
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Estoque baixo
            </span>
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                produtosBaixos.length > 0
                  ? "bg-yellow-50 text-yellow-600"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
            </div>
          </div>
          <div
            className={`font-fraunces text-xl font-bold ${produtosBaixos.length > 0 ? "text-yellow-600" : "text-foreground"}`}
          >
            {produtosBaixos.length}
          </div>
          {produtosBaixos.length > 0 ? (
            <span className="mt-0.5 block text-xs text-yellow-600">abaixo do mínimo</span>
          ) : (
            <span className="mt-0.5 block text-xs text-muted-foreground">tudo ok</span>
          )}
        </div>
      </div>

      {/* Top produtos + Pagamentos */}
      <div className="grid grid-cols-1 gap-3 desk:grid-cols-5">
        <div className="rounded-xl border border-border bg-white desk:col-span-3">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Mais vendidos</h2>
            </div>
            <Link href="/estoque" className="text-xs text-verde-mata hover:underline">
              Ver estoque � 
            </Link>
          </div>
          {topProdutos.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhuma venda no período.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {topProdutos.map((p, i) => {
                const maxVal = Number(topProdutos[0].total_val);
                const pct = maxVal > 0 ? (Number(p.total_val) / maxVal) * 100 : 0;
                return (
                  <div key={p.nome} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-5 flex-shrink-0 text-right font-fraunces text-sm font-bold text-muted-foreground/40">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{p.nome}</p>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-verde-claro"
                          style={{ width: `${pct.toFixed(1)}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-sm font-semibold text-verde-mata">
                        {formatBRL(Number(p.total_val))}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        qtd {Number(p.qtd).toFixed(2)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-white p-4 desk:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Pagamentos</h2>
          </div>
          {porMetodo.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhum pagamento no período.
            </p>
          ) : (
            <div className="space-y-2.5">
              {porMetodo.map((m) => {
                const val = Number(m._sum.valor ?? 0);
                const pct = totalMetodos > 0 ? (val / totalMetodos) * 100 : 0;
                const barColor = METODO_BAR[m.metodo] ?? "bg-verde-claro";
                return (
                  <div key={m.metodo}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {METODO_LABEL[m.metodo] ?? m.metodo}
                      </span>
                      <div className="text-right">
                        <span className="font-semibold text-foreground">{formatBRL(val)}</span>
                        <span className="ml-1 text-xs text-muted-foreground">
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full ${barColor} rounded-full transition-all`}
                        style={{ width: `${pct.toFixed(1)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="text-sm font-medium text-muted-foreground">Total</span>
                <span className="text-sm font-bold text-foreground">{formatBRL(totalMetodos)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Estoque baixo */}
      {produtosBaixos.length > 0 && (
        <div className="rounded-xl border border-yellow-200 bg-white">
          <div className="flex items-center justify-between border-b border-yellow-100 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <h2 className="text-sm font-semibold text-yellow-700">Estoque abaixo do mínimo</h2>
            </div>
            <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-700">
              {produtosBaixos.length}
            </span>
          </div>
          <div className="divide-y divide-border">
            {produtosBaixos.map((p) => {
              const pct =
                Number(p.quantidadeMinima) > 0
                  ? Math.round((Number(p.quantidade) / Number(p.quantidadeMinima)) * 100)
                  : 0;
              const uni = UNIDADE_LABEL[p.unidade] ?? p.unidade;
              return (
                <div key={p.id} className="px-4 py-2.5">
                  <div className="mb-1 flex items-center justify-between">
                    <Link
                      href={`/estoque/${p.id}`}
                      className="max-w-[55%] truncate text-sm font-medium text-foreground hover:underline"
                    >
                      {p.nome}
                    </Link>
                    <span className="ml-2 flex-shrink-0 text-xs">
                      <span
                        className={`font-semibold ${pct <= 0 ? "text-red-600" : "text-yellow-700"}`}
                      >
                        {Number(p.quantidade).toFixed(2)} {uni}
                      </span>
                      <span className="text-muted-foreground">
                        {" "}
                        / mín {Number(p.quantidadeMinima).toFixed(2)} {uni}
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
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
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {[
          {
            href: "/vendas/historico",
            Icon: History,
            label: "Histórico de vendas",
            desc: "Ver todas as vendas realizadas",
          },
          { href: "/notas", Icon: FileText, label: "Notas e recibos", desc: "Documentos emitidos" },
          {
            href: "/estoque",
            Icon: Package,
            label: "Estoque",
            desc: "Gerenciar produtos e quantidades",
          },
        ].map(({ href, Icon, label, desc }) => (
          <Link
            key={href}
            href={href}
            className="flex items-start gap-3 rounded-xl border border-border bg-white p-3 transition-all hover:border-verde-claro/50 hover:shadow-sm"
          >
            <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-verde-mata" />
            <div>
              <p className="text-sm font-semibold">{label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
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
  const periodo = (
    ["hoje", "semana", "mes"].includes(periodoParam ?? "") ? periodoParam : "hoje"
  ) as Periodo;

  return (
    <Suspense fallback={<Skeleton />}>
      <Content periodo={periodo} />
    </Suspense>
  );
}
