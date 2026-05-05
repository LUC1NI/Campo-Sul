export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { unstable_cache } from "next/cache";
import { AppLayout } from "@/components/app/app-layout";
import { prisma } from "@/lib/prisma";
import { formatBRL } from "@/lib/format";
import Link from "next/link";
import { BarChart3, Package, TrendingUp } from "lucide-react";

function getDataKey() {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${hoje.getMonth()}-${hoje.getDate()}`;
}

const getRelatorioHoje = unstable_cache(
  async (dataKey: string) => {
    void dataKey;
    const hoje = new Date();
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const fim = new Date(inicio.getTime() + 86400000);

    const [vendas, totalAgg, porMetodo, produtosBaixos] = await Promise.all([
      prisma.venda.count({ where: { createdAt: { gte: inicio, lt: fim }, status: "CONCLUIDA" } }),
      prisma.venda.aggregate({
        where: { createdAt: { gte: inicio, lt: fim }, status: "CONCLUIDA" },
        _sum: { total: true },
      }),
      prisma.pagamento.groupBy({
        by: ["metodo"],
        where: { venda: { createdAt: { gte: inicio, lt: fim }, status: "CONCLUIDA" } },
        _sum: { valor: true },
      }),
      prisma.$queryRaw<{ id: string; nome: string; quantidade: string; quantidadeMinima: string; unidade: string }[]>`
        SELECT id, nome, quantidade::text, "quantidadeMinima"::text, unidade::text
        FROM "Produto"
        WHERE ativo = true AND "deletedAt" IS NULL
          AND "quantidadeMinima" > 0
          AND quantidade <= "quantidadeMinima"
        ORDER BY nome ASC
        LIMIT 50
      `,
    ]);

    return { vendas, total: Number(totalAgg._sum.total ?? 0), porMetodo, produtosBaixos };
  },
  ["relatorio-hoje"],
  { revalidate: 60 }
);

const METODO_LABEL: Record<string, string> = {
  DINHEIRO: "Dinheiro", DEBITO: "Débito", CREDITO: "Crédito", PIX: "PIX",
};
const UNIDADE_LABEL: Record<string, string> = {
  UN: "un", KG: "kg", L: "L", SACO: "saco", CX: "cx", M: "m",
};

function RelatoriosSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-7 w-28 bg-muted rounded-lg animate-pulse" />
        <div className="h-4 w-40 bg-muted rounded animate-pulse mt-1.5" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-border p-5">
            <div className="h-4 w-24 bg-muted rounded animate-pulse mb-3" />
            <div className="h-9 w-20 bg-muted rounded animate-pulse" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-border p-5">
        <div className="h-4 w-32 bg-muted rounded animate-pulse mb-4" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between py-1.5">
            <div className="h-4 w-20 bg-muted rounded animate-pulse" />
            <div className="h-4 w-24 bg-muted rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

async function RelatoriosContent() {
  const { vendas, total, porMetodo, produtosBaixos } = await getRelatorioHoje(getDataKey());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-fraunces text-2xl font-bold text-verde-mata">Relatórios</h1>
        <p className="text-sm text-muted-foreground">Resumo do dia e indicadores</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-3"><TrendingUp className="w-4 h-4 text-verde-mata" /><span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Vendas hoje</span></div>
          <div className="font-fraunces text-3xl font-bold text-verde-mata">{vendas}</div>
        </div>
        <div className="bg-white rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-3"><BarChart3 className="w-4 h-4 text-terra" /><span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Faturamento hoje</span></div>
          <div className="font-fraunces text-3xl font-bold text-terra">{formatBRL(total)}</div>
        </div>
        <div className="bg-white rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-3"><Package className="w-4 h-4 text-yellow-600" /><span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Estoque baixo</span></div>
          <div className="font-fraunces text-3xl font-bold text-yellow-600">{produtosBaixos.length}</div>
        </div>
      </div>

      {porMetodo.length > 0 && (
        <div className="bg-white rounded-xl border border-border p-5">
          <h2 className="font-semibold text-sm mb-4">Pagamentos de hoje</h2>
          <div className="space-y-2">
            {porMetodo.map((m) => (
              <div key={m.metodo} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{METODO_LABEL[m.metodo] ?? m.metodo}</span>
                <span className="text-sm font-semibold text-verde-mata">{formatBRL(Number(m._sum.valor ?? 0))}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {produtosBaixos.length > 0 && (
        <div className="bg-white rounded-xl border border-border">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-sm text-yellow-700">Produtos com estoque baixo</h2>
            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">{produtosBaixos.length}</span>
          </div>
          <div className="divide-y divide-border">
            {produtosBaixos.map((p) => (
              <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                <Link href={`/estoque/${p.id}`} className="text-sm font-medium hover:underline">{p.nome}</Link>
                <span className="text-sm text-yellow-700 font-semibold">
                  {Number(p.quantidade).toFixed(2)} {UNIDADE_LABEL[p.unidade]}
                  <span className="text-muted-foreground font-normal ml-1">(mín: {Number(p.quantidadeMinima).toFixed(2)})</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Link href="/vendas/historico" className="bg-white rounded-xl border border-border p-4 hover:border-verde-claro/50 hover:shadow-sm transition-all">
          <h3 className="font-semibold text-sm">Histórico de vendas</h3>
          <p className="text-xs text-muted-foreground mt-1">Ver todas as vendas realizadas</p>
        </Link>
        <Link href="/notas" className="bg-white rounded-xl border border-border p-4 hover:border-verde-claro/50 hover:shadow-sm transition-all">
          <h3 className="font-semibold text-sm">Notas e recibos</h3>
          <p className="text-xs text-muted-foreground mt-1">Documentos emitidos</p>
        </Link>
      </div>
    </div>
  );
}

export default async function RelatoriosPage() {
  return (
    <AppLayout>
      <Suspense fallback={<RelatoriosSkeleton />}>
        <RelatoriosContent />
      </Suspense>
    </AppLayout>
  );
}
