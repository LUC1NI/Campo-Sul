export const dynamic = "force-dynamic";
import { requireAdminPage } from "@/lib/auth-helpers";

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatBRL, formatDataHora, formatCNPJ } from "@/lib/format";
import { ArrowLeft, PackageCheck, PackagePlus, Truck } from "lucide-react";
import Link from "next/link";

async function getEntrada(id: string) {
  return prisma.entradaXml.findUnique({
    where: { id },
    select: {
      id: true,
      numeroNf: true,
      chaveAcesso: true,
      cnpjEmitente: true,
      nomeEmitente: true,
      valorTotal: true,
      importadoEm: true,
      itens: {
        select: {
          id: true,
          descricao: true,
          gtin: true,
          quantidade: true,
          valorUnitario: true,
          valorTotal: true,
          criouProduto: true,
          produto: { select: { id: true, nome: true, codigo: true } },
        },
        orderBy: { descricao: "asc" },
      },
    },
  });
}

export default async function EntradaXmlDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage();
  const { id } = await params;
  const entrada = await getEntrada(id);

  if (!entrada) notFound();

  const totalItens = entrada.itens.reduce((s, i) => s + Number(i.quantidade), 0);
  const novos = entrada.itens.filter((i) => i.criouProduto).length;
  const atualizados = entrada.itens.filter((i) => !i.criouProduto && i.produto).length;

  return (
      <div className="space-y-5 max-w-4xl">
        <div className="flex items-center gap-3">
          <Link
            href="/notas?tab=recebidas"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="font-fraunces text-2xl font-bold text-verde-mata">
              NF-e Nº {entrada.numeroNf}
            </h1>
            <p className="text-sm text-muted-foreground">
              Importada em {formatDataHora(entrada.importadoEm)}
            </p>
          </div>
        </div>

        {/* Cabeçalho da nota */}
        <div className="bg-white rounded-xl border border-border p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-verde-mata/10 flex items-center justify-center flex-shrink-0">
                <Truck className="w-5 h-5 text-verde-mata" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">
                  Fornecedor
                </p>
                <p className="font-semibold text-foreground">{entrada.nomeEmitente}</p>
                <p className="text-sm text-muted-foreground">
                  CNPJ: {formatCNPJ(entrada.cnpjEmitente)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground mb-1">Valor total da NF-e</p>
              <p className="text-2xl font-bold text-verde-mata">
                {formatBRL(Number(entrada.valorTotal))}
              </p>
            </div>
          </div>

          {entrada.chaveAcesso && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground mb-0.5">Chave de acesso</p>
              <p className="text-xs font-mono text-muted-foreground break-all">
                {entrada.chaveAcesso}
              </p>
            </div>
          )}
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-border p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{entrada.itens.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Produtos</p>
          </div>
          <div className="bg-white rounded-xl border border-border p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{novos}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Criados</p>
          </div>
          <div className="bg-white rounded-xl border border-border p-4 text-center">
            <p className="text-2xl font-bold text-verde-claro">{atualizados}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Atualizados</p>
          </div>
        </div>

        {/* Tabela de itens */}
        <div className="bg-white rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Produto</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Qtd</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Vlr Unit.</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entrada.itens.map((item) => (
                <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground leading-tight">{item.descricao}</p>
                    {item.produto && (
                      <Link
                        href={`/estoque/${item.produto.id}`}
                        className="text-xs text-verde-claro hover:text-verde-mata transition-colors"
                      >
                        → {item.produto.nome} ({item.produto.codigo})
                      </Link>
                    )}
                    {item.gtin && (
                      <p className="text-xs text-muted-foreground">EAN: {item.gtin}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {Number(item.quantidade).toLocaleString("pt-BR", { maximumFractionDigits: 4 })}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                    {formatBRL(Number(item.valorUnitario))}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    {formatBRL(Number(item.valorTotal))}
                  </td>
                  <td className="px-4 py-3">
                    {item.criouProduto ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                        <PackagePlus className="w-3 h-3" />
                        Criado
                      </span>
                    ) : item.produto ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                        <PackageCheck className="w-3 h-3" />
                        Atualizado
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-muted/30">
                <td className="px-4 py-3 text-sm font-medium text-muted-foreground">
                  Total ({entrada.itens.length} {entrada.itens.length === 1 ? "item" : "itens"})
                </td>
                <td className="px-4 py-3 text-right text-sm tabular-nums text-muted-foreground">
                  {totalItens.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}
                </td>
                <td />
                <td className="px-4 py-3 text-right text-sm font-bold text-verde-mata tabular-nums">
                  {formatBRL(Number(entrada.valorTotal))}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
  );
}
