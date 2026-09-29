"use client";

import { useState, useRef, useCallback, RefObject, useEffect } from "react";
import { useCarrinho } from "@/stores/carrinho-store";
import { Search } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { DialogFracionado, ProdutoFracionadoInfo } from "./dialog-fracionado";
import { toast } from "sonner";
import { precoDeCatalogo } from "@/lib/venda-calculo";

type Unidade = "UN" | "KG" | "L" | "SACO" | "CX" | "M";

interface ProdutoBusca {
  id: string;
  codigo: string;
  gtin: string | null;
  nome: string;
  unidade: Unidade;
  precoVenda: string;
  podeFracionar: boolean;
  pesoUnidade: string | null;
  unidadeFracao: Unidade | null;
  quantidade: string;
  saldoFracionado: string;
  precoFracao: string | null;
}

const UNIDADE_LABEL: Record<Unidade, string> = {
  UN: "un",
  KG: "kg",
  L: "L",
  SACO: "saco",
  CX: "cx",
  M: "m",
};

interface BuscaProdutoProps {
  inputRef: RefObject<HTMLInputElement | null>;
}

export function BuscaProduto({ inputRef }: BuscaProdutoProps) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<ProdutoBusca[]>([]);
  const [aberto, setAberto] = useState(false);
  const [selecionado, setSelecionado] = useState(0);
  const [dialogFrac, setDialogFrac] = useState<{
    info: ProdutoFracionadoInfo;
    produto: ProdutoBusca;
  } | null>(null);
  const carrinhoStore = useCarrinho();
  const debouncedQuery = useDebounce(query, 150);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Query que gerou `resultados` — evita Enter adicionar item de busca antiga.
  const resultadosDe = useRef("");

  const adicionarAoCarrinho = useCallback(
    (
      p: ProdutoBusca,
      modo: "inteiro" | "fracionado" = "inteiro",
      opts?: { quantidade?: number; valorDigitado?: number | null }
    ) => {
      const fracionado =
        modo === "fracionado" && p.podeFracionar && p.unidadeFracao && p.pesoUnidade;
      const unidade = fracionado ? p.unidadeFracao! : p.unidade;
      // Mesma conta do servidor (4 casas), senão o total do caixa difere em centavos
      const precoUnitario = precoDeCatalogo(p, unidade).toNumber();
      carrinhoStore.adicionarItem({
        produtoId: p.id,
        nome: p.nome,
        codigo: p.codigo,
        unidade,
        unidadeEstoque: p.unidade,
        precoUnitario,
        quantidade: opts?.quantidade ?? 1,
        podeFracionar: p.podeFracionar,
        pesoUnidade: p.pesoUnidade ? parseFloat(String(p.pesoUnidade)) : null,
        ...(opts?.valorDigitado != null ? { valorDigitado: opts.valorDigitado } : {}),
      });
      setQuery("");
      setAberto(false);
      if (inputRef.current) inputRef.current.focus();
    },
    [carrinhoStore, inputRef]
  );

  const abrirDialogFrac = useCallback((p: ProdutoBusca) => {
    if (!p.podeFracionar || !p.unidadeFracao || !p.pesoUnidade) return;
    const precoInteiro = parseFloat(String(p.precoVenda));
    const pesoUnidade = parseFloat(String(p.pesoUnidade));
    const precoFracao = precoDeCatalogo(p, p.unidadeFracao).toNumber();
    setDialogFrac({
      produto: p,
      info: {
        nome: p.nome,
        codigo: p.codigo,
        unidade: p.unidade,
        unidadeFracao: p.unidadeFracao,
        precoInteiro,
        precoFracao,
        pesoUnidade,
        estoqueUnidades: parseFloat(String(p.quantidade)),
        saldoFracionado: parseFloat(String(p.saldoFracionado)),
      },
    });
    setAberto(false);
  }, []);

  useEffect(() => {
    if (debouncedQuery.length < 1) {
      setResultados([]);
      return;
    }
    // Cancela o fetch anterior se ainda estiver pendente
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    buscar(debouncedQuery, signal)
      .then((data) => {
        // Leitor que não manda Enter: EAN completo com match exato entra direto.
        if (/^\d{8,14}$/.test(debouncedQuery) && data[0] && ehExato(data[0], debouncedQuery)) {
          adicionarAoCarrinho(data[0], "inteiro");
        } else {
          resultadosDe.current = debouncedQuery;
          setResultados(data);
          setAberto(data.length > 0);
          setSelecionado(0);
        }
      })
      .catch((err: unknown) => {
        // AbortError é esperado quando o usuário continua digitando
        if (!(err instanceof Error && err.name === "AbortError")) {
          toast.error("Não foi possível buscar produtos. Verifique a conexão.");
        }
      });
  }, [debouncedQuery, adicionarAoCarrinho]);

  /** Enter com texto cuja busca ainda não voltou (leitor de código de barras). */
  function buscarEAdicionar(codigo: string) {
    abortRef.current?.abort();
    setQuery(""); // limpa já: próxima leitura não concatena com esta
    setAberto(false);
    buscar(codigo)
      .then((data) => {
        if (data[0] && ehExato(data[0], codigo)) adicionarAoCarrinho(data[0], "inteiro");
        else if (data.length === 1) adicionarAoCarrinho(data[0], "inteiro");
        else if (data.length > 1) {
          setQuery(codigo);
          resultadosDe.current = codigo;
          setResultados(data);
          setAberto(true);
          setSelecionado(0);
        } else toast.error(`Produto "${codigo}" não encontrado.`);
      })
      .catch(() => toast.error("Não foi possível buscar produtos. Verifique a conexão."));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const q = query.trim();
      if (aberto && resultadosDe.current === q && resultados[selecionado]) {
        adicionarAoCarrinho(resultados[selecionado], "inteiro");
      } else if (q) {
        buscarEAdicionar(q);
      }
      return;
    }
    if (!aberto) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelecionado((s) => Math.min(s + 1, resultados.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelecionado((s) => Math.max(s - 1, 0));
    } else if (e.key === "Escape") {
      setAberto(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => resultados.length > 0 && setAberto(true)}
          onBlur={() => setTimeout(() => setAberto(false), 150)}
          placeholder="Buscar produto por nome ou código... (F2)"
          aria-label="Buscar produto por nome, código ou código de barras"
          role="combobox"
          aria-expanded={aberto}
          aria-controls="busca-produto-lista"
          className="w-full rounded-xl border border-border bg-white py-3 pl-10 pr-4 text-sm transition-all focus:border-verde-mata focus:outline-none focus:ring-2 focus:ring-verde-mata/30"
          autoComplete="off"
        />
      </div>

      {aberto && resultados.length > 0 && (
        <div id="busca-produto-lista" role="listbox" className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-border bg-white shadow-xl">
          {resultados.map((p, i) => {
            const isFrac = p.podeFracionar && p.unidadeFracao && p.pesoUnidade;
            const precoInteiro = Number(p.precoVenda);
            const precoFrac = isFrac ? precoDeCatalogo(p, p.unidadeFracao!).toNumber() : null;
            const estoqueTotal = isFrac
              ? (Number(p.quantidade) * Number(p.pesoUnidade) - Number(p.saldoFracionado)).toFixed(
                  0
                )
              : null;

            return (
              <div
                key={p.id}
                onMouseDown={() => adicionarAoCarrinho(p, "inteiro")}
                role="option"
                aria-selected={i === selecionado}
                className={`flex w-full cursor-pointer items-center justify-between border-b border-border px-4 py-3 text-left transition-colors last:border-0 hover:bg-muted/50 ${i === selecionado ? "bg-verde-mata/5" : ""}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground">{p.nome}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.codigo}
                    {isFrac ? (
                      <span className="ml-2 opacity-70">
                        {Number(p.quantidade).toFixed(0)} {UNIDADE_LABEL[p.unidade]} ·{" "}
                        {estoqueTotal} {UNIDADE_LABEL[p.unidadeFracao!]}
                      </span>
                    ) : (
                      <span className="ml-2 opacity-70">
                        {Number(p.quantidade).toFixed(2)} {UNIDADE_LABEL[p.unidade]}
                      </span>
                    )}
                  </div>
                </div>
                <div className="ml-3 flex flex-shrink-0 items-center gap-2">
                  <div className="text-right">
                    <div className="text-sm font-semibold text-verde-mata">
                      R$ {precoInteiro.toFixed(2).replace(".", ",")}
                      <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                        /{UNIDADE_LABEL[p.unidade]}
                      </span>
                    </div>
                    {isFrac && (
                      <div className="text-xs text-muted-foreground">
                        R$ {precoFrac!.toFixed(2).replace(".", ",")}/
                        {UNIDADE_LABEL[p.unidadeFracao!]}
                      </div>
                    )}
                  </div>
                  {isFrac && (
                    <button
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        abrirDialogFrac(p);
                      }}
                      className="whitespace-nowrap rounded-lg border border-terra/20 bg-terra/10 px-2 py-1 text-xs text-terra transition-colors hover:bg-terra/20"
                    >
                      por {UNIDADE_LABEL[p.unidadeFracao!]}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <div className="bg-muted/30 px-4 py-2">
            <p className="text-xs text-muted-foreground">↑↓ navegar · Enter adiciona inteiro</p>
          </div>
        </div>
      )}

      <DialogFracionado
        aberto={dialogFrac !== null}
        produto={dialogFrac?.info ?? null}
        onFechar={() => {
          setDialogFrac(null);
          inputRef.current?.focus();
        }}
        onConfirmar={(quantidade, valorDigitado) => {
          if (dialogFrac) {
            adicionarAoCarrinho(dialogFrac.produto, "fracionado", { quantidade, valorDigitado });
          }
          setDialogFrac(null);
        }}
      />
    </div>
  );
}

async function buscar(q: string, signal?: AbortSignal): Promise<ProdutoBusca[]> {
  const r = await fetch(`/api/produtos/buscar?q=${encodeURIComponent(q)}`, { signal });
  if (r.status === 401) {
    window.location.href = "/login";
    return [];
  }
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

const ehExato = (p: ProdutoBusca, q: string) => p.codigo === q || p.gtin === q;
