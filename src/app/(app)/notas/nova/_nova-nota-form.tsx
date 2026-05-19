"use client";

import { useState, useRef, useCallback } from "react";
import { gerarNotaAvulsa } from "@/app/actions/notas";
import { formatBRL } from "@/lib/format";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Search, Trash2, FileText, Receipt, Package } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Enums definidos localmente para evitar @prisma/client no bundle do browser
type Unidade = "UN" | "KG" | "L" | "SACO" | "CX" | "M";
type MetodoPagamento = "DINHEIRO" | "DEBITO" | "CREDITO" | "PIX";
type TipoDocumento = "NOTA" | "RECIBO";

const UNIDADE_LABEL: Record<Unidade, string> = {
  UN: "Un",
  KG: "Kg",
  L: "Litro",
  SACO: "Saco",
  CX: "Caixa",
  M: "Metro",
};

const METODO_LABEL: Record<MetodoPagamento, string> = {
  DINHEIRO: "Dinheiro",
  DEBITO: "Débito",
  CREDITO: "Crédito",
  PIX: "PIX",
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

export function NovaNotaForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<ProdutoBusca[]>([]);
  const [buscando, setBuscando] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mostrarResultados, setMostrarResultados] = useState(false);

  const [itens, setItens] = useState<ItemNota[]>([]);

  const [tipoCliente, setTipoCliente] = useState<TipoCliente>("NAO_IDENTIFICADO");
  const [documento, setDocumento] = useState("");
  const [nomeCliente, setNomeCliente] = useState("");

  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumento>("NOTA");
  const [metodoPagamento, setMetodoPagamento] = useState<MetodoPagamento>("DINHEIRO");
  const [descontarEstoque, setDescontarEstoque] = useState(true);
  const [observacao, setObservacao] = useState("");

  const buscarProdutos = useCallback(async (q: string) => {
    if (q.length < 1) {
      setResultados([]);
      return;
    }
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
        prev.map((i, idx) => (idx === existente ? { ...i, quantidade: i.quantidade + 1 } : i))
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
    setItens((prev) => prev.map((item, i) => (i === idx ? { ...item, [campo]: valor } : item)));
  }

  const total = itens.reduce((acc, i) => acc + i.quantidade * i.precoUnitario, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (itens.length === 0) {
      toast.error("Adicione ao menos 1 item");
      return;
    }
    if (tipoCliente === "CPF" && documento.replace(/\D/g, "").length !== 11) {
      toast.error("CPF inválido");
      return;
    }
    if (tipoCliente === "CNPJ" && documento.replace(/\D/g, "").length !== 14) {
      toast.error("CNPJ inválido");
      return;
    }

    setLoading(true);
    try {
      const r = await gerarNotaAvulsa({
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

      if (!r.ok) {
        toast.error(r.erro);
        return;
      }

      toast.success("Nota gerada com sucesso!");
      const tipoPath = r.data.tipoDocumento === "NOTA" ? "nota" : "recibo";
      router.push(`/api/pdf/${tipoPath}/${r.data.documentoId}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href="/notas"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="font-fraunces text-2xl font-bold text-verde-mata">Nova Nota / Recibo</h1>
          <p className="text-sm text-muted-foreground">
            Gere um documento para vendas realizadas fora do PDV
          </p>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-white p-5">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Tipo de documento
        </h2>
        <div className="flex gap-3">
          {(["NOTA", "RECIBO"] as TipoDocumento[]).map((tipo) => (
            <button
              key={tipo}
              type="button"
              onClick={() => setTipoDocumento(tipo)}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                tipoDocumento === tipo
                  ? "border-verde-mata bg-verde-mata text-white"
                  : "border-border text-muted-foreground hover:border-verde-mata/50"
              }`}
            >
              {tipo === "NOTA" ? <FileText className="h-4 w-4" /> : <Receipt className="h-4 w-4" />}
              {tipo === "NOTA" ? "Nota Fiscal" : "Recibo"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-border bg-white p-5">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Itens</h2>

        <div className="relative">
          <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 focus-within:border-verde-mata focus-within:ring-2 focus-within:ring-verde-mata/30">
            {buscando ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <input
              type="text"
              value={busca}
              onChange={(e) => handleBuscaChange(e.target.value)}
              onFocus={() => busca && setMostrarResultados(true)}
              placeholder="Buscar produto por nome, código ou GTIN..."
              className="flex-1 bg-transparent text-sm outline-none"
              autoComplete="off"
            />
          </div>

          {mostrarResultados && resultados.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-border bg-white shadow-lg">
              {resultados.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => adicionarItem(p)}
                  className="flex w-full items-center justify-between border-b border-border px-4 py-3 text-left transition-colors last:border-0 hover:bg-muted/40"
                >
                  <div>
                    <p className="text-sm font-medium">{p.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.codigo} · {UNIDADE_LABEL[p.unidade]}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-verde-mata">
                      {formatBRL(Number(p.precoVenda))}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Estoque:{" "}
                      {Number(p.quantidade).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {mostrarResultados && resultados.length === 0 && busca.length > 0 && !buscando && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-xl border border-border bg-white px-4 py-3 text-sm text-muted-foreground shadow-lg">
              Nenhum produto encontrado
            </div>
          )}
        </div>

        {itens.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-2 text-left font-medium text-muted-foreground">Produto</th>
                  <th className="w-24 pb-2 text-center font-medium text-muted-foreground">Qtd</th>
                  <th className="w-28 pb-2 text-right font-medium text-muted-foreground">Preço</th>
                  <th className="w-24 pb-2 text-right font-medium text-muted-foreground">Total</th>
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
                        className="w-20 rounded border border-border px-2 py-1 text-center text-sm focus:outline-none focus:ring-1 focus:ring-verde-mata"
                      />
                    </td>
                    <td className="py-2.5 text-right">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={item.precoUnitario}
                        onChange={(e) =>
                          atualizarItem(idx, "precoUnitario", Number(e.target.value))
                        }
                        className="w-24 rounded border border-border px-2 py-1 text-right text-sm focus:outline-none focus:ring-1 focus:ring-verde-mata"
                      />
                    </td>
                    <td className="py-2.5 text-right font-medium text-verde-mata">
                      {formatBRL(item.quantidade * item.precoUnitario)}
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => removerItem(idx)}
                        className="text-muted-foreground transition-colors hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 flex justify-end border-t border-border pt-3">
              <span className="text-base font-bold text-verde-mata">Total: {formatBRL(total)}</span>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            <Package className="mx-auto mb-2 h-8 w-8 opacity-30" />
            <p className="text-sm">Busque e adicione produtos acima</p>
          </div>
        )}
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-white p-5">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Cliente
        </h2>
        <div className="flex flex-wrap gap-2">
          {(["NAO_IDENTIFICADO", "CPF", "CNPJ"] as TipoCliente[]).map((tipo) => (
            <button
              key={tipo}
              type="button"
              onClick={() => {
                setTipoCliente(tipo);
                setDocumento("");
              }}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                tipoCliente === tipo
                  ? "border-verde-mata bg-verde-mata/10 font-medium text-verde-mata"
                  : "border-border text-muted-foreground hover:border-verde-mata/50"
              }`}
            >
              {tipo === "NAO_IDENTIFICADO" ? "Não identificado" : tipo}
            </button>
          ))}
        </div>

        {tipoCliente !== "NAO_IDENTIFICADO" && (
          <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {tipoCliente}
              </label>
              <input
                type="text"
                value={formatarDoc(tipoCliente, documento)}
                onChange={(e) => setDocumento(e.target.value.replace(/\D/g, ""))}
                maxLength={tipoCliente === "CPF" ? 14 : 18}
                placeholder={tipoCliente === "CPF" ? "000.000.000-00" : "00.000.000/0001-00"}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-verde-mata focus:outline-none focus:ring-2 focus:ring-verde-mata/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Nome (opcional)
              </label>
              <input
                type="text"
                value={nomeCliente}
                onChange={(e) => setNomeCliente(e.target.value)}
                placeholder="Nome do cliente"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-verde-mata focus:outline-none focus:ring-2 focus:ring-verde-mata/30"
              />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4 rounded-xl border border-border bg-white p-5">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Opções
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Forma de pagamento
            </label>
            <select
              value={metodoPagamento}
              onChange={(e) => setMetodoPagamento(e.target.value as MetodoPagamento)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-verde-mata focus:outline-none focus:ring-2 focus:ring-verde-mata/30"
            >
              {(Object.keys(METODO_LABEL) as MetodoPagamento[]).map((m) => (
                <option key={m} value={m}>
                  {METODO_LABEL[m]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Observação (opcional)
            </label>
            <input
              type="text"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: venda balcão"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-verde-mata focus:outline-none focus:ring-2 focus:ring-verde-mata/30"
            />
          </div>
        </div>

        <div
          className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 p-4 transition-colors ${
            descontarEstoque ? "border-verde-mata bg-verde-mata/5" : "border-amber-400 bg-amber-50"
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
              {descontarEstoque
                ? "Descontar itens do estoque"
                : "Apenas gerar documento (sem mexer no estoque)"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {descontarEstoque
                ? "As quantidades serão deduzidas do estoque normalmente."
                : "Nenhum produto será descontado do estoque — apenas o documento é gerado."}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Link
          href="/notas"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={loading || itens.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-verde-mata px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-verde-claro disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {tipoDocumento === "NOTA" ? (
            <FileText className="h-4 w-4" />
          ) : (
            <Receipt className="h-4 w-4" />
          )}
          Gerar {tipoDocumento === "NOTA" ? "Nota Fiscal" : "Recibo"}
          {total > 0 && ` · ${formatBRL(total)}`}
        </button>
      </div>
    </form>
  );
}
