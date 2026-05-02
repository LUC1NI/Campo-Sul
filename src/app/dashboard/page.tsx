export const dynamic = "force-dynamic";

import { AppLayout } from "@/components/app/app-layout";
import { prisma } from "@/lib/prisma";
import { formatBRL, formatData } from "@/lib/format";
import { ShoppingCart, TrendingUp, Package, AlertTriangle } from "lucide-react";

async function getDashboardData() {
  const hoje = new Date();
  const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const fimHoje = new Date(inicioHoje.getTime() + 24 * 60 * 60 * 1000);

  const [vendasHoje, totalHoje, ultimasVendas] = await Promise.all([
    prisma.venda.count({
      where: { createdAt: { gte: inicioHoje, lt: fimHoje }, status: "CONCLUIDA" },
    }),
    prisma.venda.aggregate({
      where: { createdAt: { gte: inicioHoje, lt: fimHoje }, status: "CONCLUIDA" },
      _sum: { total: true },
    }),
    prisma.venda.findMany({
      where: { status: "CONCLUIDA" },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { usuario: { select: { nome: true } } },
    }),
  ]);

  return { vendasHoje, totalHoje: totalHoje._sum.total ?? 0, ultimasVendas };
}

export default async function DashboardPage() {
  const { vendasHoje, totalHoje, ultimasVendas } = await getDashboardData();

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-fraunces text-2xl font-bold text-verde-mata">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {formatData(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy")}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard titulo="Vendas hoje" valor={String(vendasHoje)} icon={ShoppingCart} cor="verde" />
          <StatCard titulo="Total hoje" valor={formatBRL(Number(totalHoje))} icon={TrendingUp} cor="terra" />
          <StatCard titulo="Produtos ativos" valor="—" icon={Package} cor="neutro" />
          <StatCard titulo="Estoque baixo" valor="—" icon={AlertTriangle} cor="alerta" />
        </div>

        <div className="bg-white rounded-xl border border-border">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-sm text-foreground">Últimas vendas</h2>
          </div>
          <div className="divide-y divide-border">
            {ultimasVendas.length === 0 ? (
              <p className="px-5 py-8 text-sm text-muted-foreground text-center">
                Nenhuma venda ainda hoje.
              </p>
            ) : (
              ultimasVendas.map((venda) => (
                <div key={venda.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-foreground">Venda #{venda.numero}</span>
                    <span className="ml-2 text-xs text-muted-foreground">por {venda.usuario.nome}</span>
                  </div>
                  <div className="text-sm font-semibold text-verde-mata">
                    {formatBRL(Number(venda.total))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function StatCard({
  titulo, valor, icon: Icon, cor,
}: {
  titulo: string;
  valor: string;
  icon: React.ComponentType<{ className?: string }>;
  cor: "verde" | "terra" | "neutro" | "alerta";
}) {
  const cores = {
    verde: "bg-verde-mata/10 text-verde-mata",
    terra: "bg-terra/10 text-terra",
    neutro: "bg-muted text-muted-foreground",
    alerta: "bg-yellow-50 text-yellow-700",
  };
  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{titulo}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cores[cor]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="font-fraunces text-2xl font-bold text-foreground">{valor}</div>
    </div>
  );
}
