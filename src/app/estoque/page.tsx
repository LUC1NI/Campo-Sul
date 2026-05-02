export const dynamic = "force-dynamic";

import { AppLayout } from "@/components/app/app-layout";
import { prisma } from "@/lib/prisma";
import { formatBRL, formatarQuantidade } from "@/lib/format";
import Link from "next/link";
import { Plus, Upload, Package, AlertTriangle, Tag, ArchiveX, Pencil } from "lucide-react";
import { Unidade } from "@prisma/client";
import { BotaoDesativar } from "./_botao-desativar";
import { BotaoReativar } from "./_botao-reativar";
import { FiltrosEstoque } from "./_filtros-estoque";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const UNIDADE_LABEL: Record<Unidade, string> = {
  UN: "Unidade", KG: "Kg", L: "Litro", SACO: "Saco", CX: "Caixa", M: "Metro",
};

interface FiltrosProdutos {
  q?: string;
  categoria?: string;
  unidade?: string;
  baixo?: boolean;
  fracionavel?: boolean;
}

async function getProdutos({ q, categoria, unidade, baixo, fracionavel }: FiltrosProdutos) {
  const produtos = await prisma.produto.findMany({
    where: {
      ativo: true,
      deletedAt: null,
      ...(q ? {
        OR: [
          { nome: { contains: q, mode: "insensitive" } },
          { codigo: { contains: q, mode: "insensitive" } },
        ],
      } : {}),
      ...(categoria ? { categoriaId: categoria } : {}),
      ...(unidade ? { unidade: unidade as Unidade } : {}),
      ...(fracionavel ? { podeFracionar: true } : {}),
    },
    include: { categoria: true },
    orderBy: { nome: "asc" },
    take: 100,
  });

  if (baixo) {
    return produtos.filter(
      (p) => Number(p.quantidadeMinima) > 0 && Number(p.quantidade) <= Number(p.quantidadeMinima)
    );
  }
  return produtos;
}

async function getInativos(q?: string) {
  return prisma.produto.findMany({
    where: {
      ativo: false,
      ...(q ? {
        OR: [
          { nome: { contains: q, mode: "insensitive" } },
          { codigo: { contains: q, mode: "insensitive" } },
        ],
      } : {}),
    },
    include: { categoria: true },
    orderBy: { deletedAt: "desc" },
    take: 100,
  });
}

export default async function EstoquePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; categoria?: string; unidade?: string; baixo?: string; fracionavel?: string }>;
}) {
  const params = await searchParams;
  const verInativos = params.status === "inativos";

  const [produtos, inativosOuCount, categorias] = await Promise.all([
    verInativos ? Promise.resolve([]) : getProdutos({
      q: params.q,
      categoria: params.categoria,
      unidade: params.unidade,
      baixo: params.baixo === "1",
      fracionavel: params.fracionavel === "1",
    }),
    verInativos ? getInativos(params.q) : prisma.produto.count({ where: { ativo: false } }),
    prisma.categoria.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
  ]);

  const totalInativos = verInativos
    ? (inativosOuCount as Awaited<ReturnType<typeof getInativos>>).length
    : (inativosOuCount as number);
  const inativos = verInativos ? (inativosOuCount as Awaited<ReturnType<typeof getInativos>>) : [];

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-fraunces text-2xl font-bold text-verde-mata">Estoque</h1>
            <p className="text-sm text-muted-foreground">
              {verInativos
                ? `${totalInativos} produto${totalInativos !== 1 ? "s" : ""} inativo${totalInativos !== 1 ? "s" : ""}`
                : `${produtos.length} produto${produtos.length !== 1 ? "s" : ""} encontrado${produtos.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/estoque/categorias" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">
              <Tag className="w-4 h-4" />Categorias
            </Link>
            <Link href="/estoque/importar-xml" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">
              <Upload className="w-4 h-4" />Importar XML
            </Link>
            <Link href="/estoque/novo" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-verde-mata text-white text-sm hover:bg-verde-claro transition-colors">
              <Plus className="w-4 h-4" />Novo produto
            </Link>
          </div>
        </div>

        {/* Abas */}
        <div className="flex items-center gap-1 border-b border-border">
          <Link
            href="/estoque"
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              !verInativos
                ? "border-verde-mata text-verde-mata"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Ativos
          </Link>
          <Link
            href="/estoque?status=inativos"
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              verInativos
                ? "border-verde-mata text-verde-mata"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Inativos
            {totalInativos > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                verInativos ? "bg-verde-mata/15 text-verde-mata" : "bg-muted text-muted-foreground"
              }`}>
                {totalInativos}
              </span>
            )}
          </Link>
        </div>

        {/* Filtros (ativos) ou busca simples (inativos) */}
        {!verInativos ? (
          <FiltrosEstoque categorias={categorias} />
        ) : (
          <form className="flex gap-2">
            <input type="hidden" name="status" value="inativos" />
            <input
              name="q"
              defaultValue={params.q}
              placeholder="Buscar por nome..."
              className="flex-1 max-w-sm px-3.5 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-verde-mata/30 focus:border-verde-mata"
            />
            <button type="submit" className="px-4 py-2 bg-verde-mata text-white rounded-lg text-sm hover:bg-verde-claro transition-colors">
              Buscar
            </button>
          </form>
        )}

        {/* Tabela ativos */}
        {!verInativos && (
          <div className="bg-white rounded-xl border border-border overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Produto</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Categoria</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Unidade</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Qtd. estoque</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Preço venda</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {produtos.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />Nenhum produto encontrado
                  </td></tr>
                ) : (
                  produtos.map((p) => {
                    const baixo = Number(p.quantidade) <= Number(p.quantidadeMinima) && Number(p.quantidadeMinima) > 0;
                    return (
                      <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{p.nome}</span>
                            {p.podeFracionar && <span className="text-xs bg-bege text-terra px-1.5 py-0.5 rounded">fracionável</span>}
                            {baixo && <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" aria-label="Estoque baixo" />}
                          </div>
                          <div className="text-xs text-muted-foreground">{p.codigo}</div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{p.categoria?.nome ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {UNIDADE_LABEL[p.unidade]}
                          {p.podeFracionar && p.unidadeFracao && (
                            <span className="text-xs ml-1 text-muted-foreground/60">(vende em {UNIDADE_LABEL[p.unidadeFracao]})</span>
                          )}
                        </td>
                        <td className={`px-4 py-3 text-right font-medium ${baixo ? "text-yellow-600" : "text-foreground"}`}>
                          {formatarQuantidade(Number(p.quantidade), p.unidade, p.podeFracionar)} {UNIDADE_LABEL[p.unidade]}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-verde-mata">
                          {formatBRL(Number(p.precoVenda))}
                          {p.podeFracionar && p.unidadeFracao && (
                            <span className="text-xs text-muted-foreground ml-1">/{UNIDADE_LABEL[p.unidadeFracao!]}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Link href={`/estoque/${p.id}`} title="Editar produto" className="p-1.5 rounded-lg text-muted-foreground hover:text-verde-mata hover:bg-verde-mata/10 transition-colors">
                              <Pencil className="w-4 h-4" />
                            </Link>
                            <BotaoDesativar id={p.id} nome={p.nome} />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tabela inativos */}
        {verInativos && (
          <div className="bg-white rounded-xl border border-border overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Produto</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Categoria</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Desativado em</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {inativos.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                    <ArchiveX className="w-8 h-8 mx-auto mb-2 opacity-30" />Nenhum produto inativo
                  </td></tr>
                ) : (
                  inativos.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors opacity-70">
                      <td className="px-4 py-3">
                        <span className="font-medium text-foreground">{p.nome}</span>
                        <div className="text-xs text-muted-foreground">{p.codigo}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{p.categoria?.nome ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {p.deletedAt
                          ? format(new Date(p.deletedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <BotaoReativar id={p.id} nome={p.nome} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
