import { AppLayout } from "@/components/app/app-layout";
import { buscarVendas } from "@/app/actions/vendas";
import { formatBRL, formatDataHora } from "@/lib/format";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { PdfLink } from "@/components/notas/pdf-link";

function buildPages(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  if (current > 3) pages.push("...");
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p);
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}

const METODO_LABEL: Record<string, string> = {
  DINHEIRO: "Dinheiro", DEBITO: "Débito", CREDITO: "Crédito", PIX: "PIX",
};

export default async function HistoricoVendasPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>;
}) {
  const params = await searchParams;
  const pagina = Number(params.pagina) || 1;
  const { vendas, total, paginas } = await buscarVendas(pagina, 30);

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-fraunces text-2xl font-bold text-verde-mata">Histórico de Vendas</h1>
            <p className="text-sm text-muted-foreground">{total} vendas no total</p>
          </div>
          <Link href="/vendas" className="text-sm text-verde-mata hover:underline">← PDV</Link>
        </div>

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
                    Nenhuma venda ainda
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
              <Link href={`/vendas/historico?pagina=${pagina - 1}`} className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted transition-colors">←</Link>
            )}
            {buildPages(pagina, paginas).map((p, i) =>
              p === "..." ? (
                <span key={`e-${i}`} className="px-2 text-muted-foreground text-sm">…</span>
              ) : (
                <Link
                  key={p}
                  href={`/vendas/historico?pagina=${p}`}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors ${
                    p === pagina ? "bg-verde-mata text-white" : "border border-border hover:bg-muted"
                  }`}
                >
                  {p}
                </Link>
              )
            )}
            {pagina < paginas && (
              <Link href={`/vendas/historico?pagina=${pagina + 1}`} className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted transition-colors">→</Link>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
