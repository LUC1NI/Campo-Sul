"use client";

import { useState, useRef, useCallback } from "react";
import { AppLayout } from "@/components/app/app-layout";
import { gerarNotaAvulsa } from "@/app/actions/notas";
import { formatBRL } from "@/lib/format";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Search,
  Plus,
  Trash2,
  FileText,
  Receipt,
  Package,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Unidade, MetodoPagamento, TipoDocumento } from "@prisma/client";

const UNIDADE_LABEL: Record<Unidade, string> = {
  UN: "Un", KG: "Kg", L: "Litro", SACO: "Saco", CX: "Caixa", M: "Metro",
};

const METODO_LABEL: Record<MetodoPagamento, string> = {
  DINHEIRO: "Dinheiro", DEBITO: "Débito", CREDITO: "Crédito", PIX: "PIX",
};

type ProdutoBusca = {
  id: string;
  codigo: string;
  nome: string;
  unidade: Unidade;
  precoVenda: string;
  quantidade: string;
  podeFracionar: boolean;
};

type ItemNota = {
  produtoId: string;
  nome: string;
  unidade: Unidade;
  quantidade: number;
  precoUnitario: number;
};

type TipoCliente = "NAO_IDENTIFICADO" | "CPF" | "CNPJ";

function formatarDoc(tipo: TipoCliente, valor: string) {
  const d = valor.replace(/\D/g, "");
  if (tipo === "CPF") {
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (tipo === "CNPJ") {
    return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return valor;
}

export default function NovaNota() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Busca de produto
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<ProdutoBusca[]>([]);
  const [buscando, setBuscando] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mostrarResultados, setMostrarResultados] = useState(false);

  // Itens da nota
  const [itens, setItens] = useState<ItemNota[]>([]);

  // Cliente
  const [tipoCliente, setTipoCliente] = useState<TipoCliente>("NAO_IDENTIFICADO");
  const [documento, setDocumento] = useState("");
  const [nomeCliente, setNomeCliente] = useState("");

  // Nota
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumento>("NOTA");
  const [metodoPagamento, setMetodoPagamento] = useState<MetodoPagamento>("DINHEIRO");
  const [descontarEstoque, setDescontarEstoque] = useState(true);
  const [observacao, setObservacao] = useState("");

  const buscarProdutos = useCallback(async (q: string) => {
    if (q.length < 1) { setResultados([]); return; }
    setBuscando(true);
    try {
      const res = await fetch(`/api/produtos/buscar?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResultados(data);
      setMostrarResultados(true);
    } catch {
      // ignore
    } finally {
      setBuscando(false);
    }
  }, []);

  function handleBuscaChange(v: string) {
    setBusca(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscarProdutos(v), 250);
  }

  function adicionarItem(produto: ProdutoBusca) {
    setMostrarResultados(false);
    setBusca("");
    setResultados([]);

    const existente = itens.findIndex((i) => i.produtoId === produto.id);
    if (existente >= 0) {
      setItens((prev) =>
        prev.map((i, idx) => idx === existente ? { ...i, quantidade: i.quantidade + 1 } : i)
      );
      return;
    }
    setItens((prev) => [
      ...prev,
      {
        produtoId: produto.id,
        nome: produto.nome,
        unidade: produto.unidade,
        quantidade: 1,
        precoUnitario: Number(produto.precoVenda),
      },
    ]);
  }

  function removerItem(idx: number) {
    setItens((prev) => prev.filter((_, i) => i !== idx));
  }

  function atualizarItem(idx: number, campo: "quantidade" | "precoUnitario", valor: number) {
    setItens((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [campo]: valor } : item))
    );
  }

  const total = itens.reduce((acc, i) => acc + i.quantidade * i.precoUnitario, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (itens.length === 0) { toast.error("Adicione ao menos 1 item"); return; }
    if (tipoCliente === "CPF" && documento.replace(/\D/g, "").length !== 11) {
      toast.error("CPF inválido"); return;
    }
    if (tipoCliente === "CNPJ" && documento.replace(/\D/g, "").length !== 14) {
      toast.error("CNPJ inválido"); return;
    }

    setLoading(true);
    try {
      const resultado = await gerarNotaAvulsa({
        itens: itens.map((i) => ({
          produtoId: i.produtoId,
          unidadeVenda: i.unidade,
          quantidade: i.quantidade,
          precoUnitario: i.precoUnitario,
        })),
        tipoDocumento,
        metodoPagamento,
        cpfCnpj: tipoCliente !== "NAO_IDENTIFICADO" ? documento.replace(/\D/g, "") : undefined,
        nomeCliente: nomeCliente || undefined,
        observacao: observacao || undefined,
        descontarEstoque,
      });

      toast.success("Nota gerada com sucesso!");
      // Redireciona para o PDF
      const tipoPath = resultado.tipoDocumento === "NOTA" ? "nota" : "recibo";
      router.push(`/api/pdf/${tipoPath}/${resultado.documentoId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar nota");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout>
      <form onSubmit={handleSubmit} className="space-y-5 max-w-3xl">
        {/* Cabeçalho */}
        <div className="flex items-center gap-3">
          <Link
            href="/notas"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="font-fraunces text-2xl font-bold text-verde-mata">
              Nova Nota / Recibo
            </h1>
            <p className="text-sm text-muted-foreground">
              Gere um documento para vendas realizadas fora do PDV
            </p>
          </div>
        </div>

        {/* Tipo de documento */}
        <div className="bg-white rounded-xl border border-border p-5 space-y-3">
          <h2 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Tipo de documento
          </h2>
          <div className="flex gap-3">
            {(["NOTA", "RECIBO"] as TipoDocumento[]).map((tipo) => (
              <button
                key={tipo}
                type="button"
                onClick={() => setTipoDocumento(tipo)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  tipoDocumento === tipo
                    ? "border-verde-mata bg-verde-mata text-white"
                    : "border-border text-muted-foreground hover:border-verde-mata/50"
                }`}
              >
                {tipo === "NOTA" ? <FileText className="w-4 h-4" /> : <Receipt className="w-4 h-4" />}
                {tipo === "NOTA" ? "Nota Fiscal" : "Recibo"}
              </button>
            ))}
          </div>
        </div>

        {/* Busca e itens */}
        <div className="bg-white rounded-xl border border-border p-5 space-y-4">
          <h2 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Itens
          </h2>

          {/* Busca */}
          <div className="relative">
            <div className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg focus-within:ring-2 focus-within:ring-verde-mata/30 focus-within:border-verde-mata">
              {buscando ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />
              ) : (
                <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              )}
              <input
                type="text"
                value={busca}
                onChange={(e) => handleBuscaChange(e.target.value)}
                onFocus={() => busca && setMostrarResultados(true)}
                placeholder="Buscar produto por nome, código ou GTIN..."
                className="flex-1 text-sm bg-transparent outline-none"
                autoComplete="off"
              />
            </div>

            {mostrarResultados && resultados.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-border rounded-xl shadow-lg overflow-hidden">
                {resultados.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => adicionarItem(p)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors text-left border-b border-border last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium">{p.nome}</p>
                      <p className="text-xs text-muted-foreground">{p.codigo} · {UNIDADE_LABEL[p.unidade]}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-verde-mata">{formatBRL(Number(p.precoVenda))}</p>
                      <p className="text-xs text-muted-foreground">Estoque: {Number(p.quantidade).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {mostrarResultados && resultados.length === 0 && busca.length > 0 && !buscando && (
              <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-border rounded-xl shadow-lg px-4 py-3 text-sm text-muted-foreground">
                Nenhum produto encontrado
              </div>
            )}
          </div>

          {/* Tabela de itens */}
          {itens.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left pb-2 font-medium text-muted-foreground">Produto</th>
                    <th className="text-center pb-2 font-medium text-muted-foreground w-24">Qtd</th>
                    <th className="text-right pb-2 font-medium text-muted-foreground w-28">Preço</th>
                    <th className="text-right pb-2 font-medium text-muted-foreground w-24">Total</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {itens.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5">
                        <p className="font-medium">{item.nome}</p>
                        <p className="text-xs text-muted-foreground">{UNIDADE_LABEL[item.unidade]}</p>
                      </td>
                      <td className="py-2.5 text-center">
                        <input
                          type="number"
                          step="0.001"
                          min="0.001"
                          value={item.quantidade}
                          onChange={(e) => atualizarItem(idx, "quantidade", Number(e.target.value))}
                          className="w-20 text-center px-2 py-1 border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-verde-mata"
                        />
                      </td>
                      <td className="py-2.5 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={item.precoUnitario}
                          onChange={(e) => atualizarItem(idx, "precoUnitario", Number(e.target.value))}
                          className="w-24 text-right px-2 py-1 border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-verde-mata"
                        />
                      </td>
                      <td className="py-2.5 text-right font-medium text-verde-mata">
                        {formatBRL(item.quantidade * item.precoUnitario)}
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => removerItem(idx)}
                          className="text-muted-foreground hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-end pt-3 border-t border-border mt-2">
                <span className="text-base font-bold text-verde-mata">
                  Total: {formatBRL(total)}
                </span>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Busque e adicione produtos acima</p>
            </div>
          )}
        </div>

        {/* Cliente */}
        <div className="bg-white rounded-xl border border-border p-5 space-y-3">
          <h2 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Cliente
          </h2>
          <div className="flex gap-2 flex-wrap">
            {(["NAO_IDENTIFICADO", "CPF", "CNPJ"] as TipoCliente[]).map((tipo) => (
              <button
                key={tipo}
                type="button"
                onClick={() => { setTipoCliente(tipo); setDocumento(""); }}
                className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                  tipoCliente === tipo
                    ? "border-verde-mata bg-verde-mata/10 text-verde-mata font-medium"
                    : "border-border text-muted-foreground hover:border-verde-mata/50"
                }`}
              >
                {tipo === "NAO_IDENTIFICADO" ? "Não identificado" : tipo}
              </button>
            ))}
          </div>

          {tipoCliente !== "NAO_IDENTIFICADO" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  {tipoCliente}
                </label>
                <input
                  type="text"
                  value={formatarDoc(tipoCliente, documento)}
                  onChange={(e) => setDocumento(e.target.value.replace(/\D/g, ""))}
                  maxLength={tipoCliente === "CPF" ? 14 : 18}
                  placeholder={tipoCliente === "CPF" ? "000.000.000-00" : "00.000.000/0001-00"}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-verde-mata/30 focus:border-verde-mata"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  Nome (opcional)
                </label>
                <input
                  type="text"
                  value={nomeCliente}
                  onChange={(e) => setNomeCliente(e.target.value)}
                  placeholder="Nome do cliente"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-verde-mata/30 focus:border-verde-mata"
                />
              </div>
            </div>
          )}
        </div>

        {/* Opções */}
        <div className="bg-white rounded-xl border border-border p-5 space-y-4">
          <h2 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Opções
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Forma de pagamento
              </label>
              <select
                value={metodoPagamento}
                onChange={(e) => setMetodoPagamento(e.target.value as MetodoPagamento)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-verde-mata/30 focus:border-verde-mata"
              >
                {(Object.keys(METODO_LABEL) as MetodoPagamento[]).map((m) => (
                  <option key={m} value={m}>{METODO_LABEL[m]}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Observação (opcional)
              </label>
              <input
                type="text"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Ex: venda balcão"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-verde-mata/30 focus:border-verde-mata"
              />
            </div>
          </div>

          {/* Opção de estoque — destaque */}
          <div
            className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
              descontarEstoque
                ? "border-verde-mata bg-verde-mata/5"
                : "border-amber-400 bg-amber-50"
            }`}
            onClick={() => setDescontarEstoque((v) => !v)}
          >
            <input
              type="checkbox"
              checked={descontarEstoque}
              onChange={(e) => setDescontarEstoque(e.target.checked)}
              className="mt-0.5 accent-verde-mata"
              onClick={(e) => e.stopPropagation()}
            />
            <div>
              <p className="text-sm font-medium">
                {descontarEstoque ? "Descontar itens do estoque" : "Apenas gerar documento (sem mexer no estoque)"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {descontarEstoque
                  ? "As quantidades serão deduzidas do estoque normalmente."
                  : "Nenhum produto será descontado do estoque — apenas o documento é gerado."}
              </p>
            </div>
          </div>
        </div>

        {/* Botão */}
        <div className="flex items-center justify-between">
          <Link
            href="/notas"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={loading || itens.length === 0}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-verde-mata text-white rounded-lg text-sm font-medium hover:bg-verde-claro transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {tipoDocumento === "NOTA" ? <FileText className="w-4 h-4" /> : <Receipt className="w-4 h-4" />}
            Gerar {tipoDocumento === "NOTA" ? "Nota Fiscal" : "Recibo"}
            {total > 0 && ` · ${formatBRL(total)}`}
          </button>
        </div>
      </form>
    </AppLayout>
  );
}
