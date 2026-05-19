export const dynamic = "force-dynamic";

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
  const { id } = await params;
  const entrada = await getEntrada(id);

  if (!entrada) notFound();

  const totalItens = entrada.itens.reduce((s, i) => s + Number(i.quantidade), 0);
  const novos = entrada.itens.filter((i) => i.criouProduto).length;
  const atualizados = entrada.itens.filter((i) => !i.criouProduto && i.produto).length;

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href="/notas?tab=recebidas"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
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
      <div className="rounded-xl border border-border bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-verde-mata/10">
              <Truck className="h-5 w-5 text-verde-mata" />
            </div>
            <div>
              <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Fornecedor
              </p>
              <p className="font-semibold text-foreground">{entrada.nomeEmitente}</p>
              <p className="text-sm text-muted-foreground">
                CNPJ: {formatCNPJ(entrada.cnpjEmitente)}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="mb-1 text-xs text-muted-foreground">Valor total da NF-e</p>
            <p className="text-2xl font-bold text-verde-mata">
              {formatBRL(Number(entrada.valorTotal))}
            </p>
          </div>
        </div>

        {entrada.chaveAcesso && (
          <div className="mt-4 border-t border-border pt-4">
            <p className="mb-0.5 text-xs text-muted-foreground">Chave de acesso</p>
            <p className="break-all font-mono text-xs text-muted-foreground">
              {entrada.chaveAcesso}
            </p>
          </div>
        )}
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-white p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{entrada.itens.length}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Produtos</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{novos}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Criados</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-4 text-center">
          <p className="text-2xl font-bold text-verde-claro">{atualizados}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Atualizados</p>
        </div>
      </div>

      {/* Tabela de itens */}
      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Produto</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Qtd</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Vlr Unit.</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entrada.itens.map((item) => (
              <tr key={item.id} className="transition-colors hover:bg-muted/20">
                <td className="px-4 py-3">
                  <p className="font-medium leading-tight text-foreground">{item.descricao}</p>
                  {item.produto && (
                    <Link
                      href={`/estoque/${item.produto.id}`}
                      className="text-xs text-verde-claro transition-colors hover:text-verde-mata"
                    >
                      �  {item.produto.nome} ({item.produto.codigo})
                    </Link>
                  )}
                  {item.gtin && <p className="text-xs text-muted-foreground">EAN: {item.gtin}</p>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {Number(item.quantidade).toLocaleString("pt-BR", { maximumFractionDigits: 4 })}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {formatBRL(Number(item.valorUnitario))}
                </td>
                <td className="px-4 py-3 text-right font-medium tabular-nums">
                  {formatBRL(Number(item.valorTotal))}
                </td>
                <td className="px-4 py-3">
                  {item.criouProduto ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                      <PackagePlus className="h-3 w-3" />
                      Criado
                    </span>
                  ) : item.produto ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs text-green-700">
                      <PackageCheck className="h-3 w-3" />
                      Atualizado
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">�</span>
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
              <td className="px-4 py-3 text-right text-sm font-bold tabular-nums text-verde-mata">
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
