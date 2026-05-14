"use client";

import { useState, useRef, useCallback, RefObject, useEffect } from "react";
import { useCarrinho } from "@/stores/carrinho-store";
import { Search } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";

type Unidade = "UN" | "KG" | "L" | "SACO" | "CX" | "M";

interface ProdutoBusca {
  id: string;
  codigo: string;
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
  UN: "un", KG: "kg", L: "L", SACO: "saco", CX: "cx", M: "m",
};

interface BuscaProdutoProps {
  inputRef: RefObject<HTMLInputElement | null>;
}

export function BuscaProduto({ inputRef }: BuscaProdutoProps) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<ProdutoBusca[]>([]);
  const [aberto, setAberto] = useState(false);
  const [selecionado, setSelecionado] = useState(0);
  const carrinhoStore = useCarrinho();
  const debouncedQuery = useDebounce(query, 150);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const adicionarAoCarrinho = useCallback(
    (p: ProdutoBusca, modo: "inteiro" | "fracionado" = "inteiro") => {
      const fracionado = modo === "fracionado" && p.podeFracionar && p.unidadeFracao && p.pesoUnidade;
      const unidade = fracionado ? p.unidadeFracao! : p.unidade;
      const precoUnitario = fracionado
        ? (p.precoFracao
            ? parseFloat(String(p.precoFracao))
            : parseFloat(String(p.precoVenda)) / parseFloat(String(p.pesoUnidade)))
        : parseFloat(String(p.precoVenda));
      carrinhoStore.adicionarItem({
        produtoId: p.id,
        nome: p.nome,
        codigo: p.codigo,
        unidade,
        unidadeEstoque: p.unidade,
        precoUnitario,
        quantidade: 1,
        podeFracionar: p.podeFracionar,
        pesoUnidade: p.pesoUnidade ? parseFloat(String(p.pesoUnidade)) : null,
      });
      setQuery("");
      setAberto(false);
      if (inputRef.current) inputRef.current.focus();
    },
    [carrinhoStore, inputRef]
  );

  useEffect(() => {
    if (debouncedQuery.length < 1) {
      setResultados([]);
      return;
    }
    // Cancela o fetch anterior se ainda estiver pendente
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    fetch(`/api/produtos/buscar?q=${encodeURIComponent(debouncedQuery)}`, { signal })
      .then((r) => r.json())
      .then((data: ProdutoBusca[]) => {
        // Leitora de código de barras: digita EAN + Enter antes do debounce.
        // Se volta 1 resultado e a query parece um código de barras (só dígitos,
        // 8–14 chars), adiciona direto sem precisar de Enter.
        const pareceCodigoBarras = /^\d{8,14}$/.test(debouncedQuery);
        if (data.length === 1 && pareceCodigoBarras) {
          adicionarAoCarrinho(data[0], "inteiro");
        } else {
          setResultados(data);
          setAberto(data.length > 0);
          setSelecionado(0);
        }
      })
      .catch((err: unknown) => {
        // AbortError é esperado quando o usuário continua digitando
        if (err instanceof Error && err.name !== "AbortError") throw err;
      });
  }, [debouncedQuery, adicionarAoCarrinho]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!aberto) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelecionado((s) => Math.min(s + 1, resultados.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelecionado((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (resultados[selecionado]) adicionarAoCarrinho(resultados[selecionado], "inteiro");
    } else if (e.key === "Escape") {
      setAberto(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => resultados.length > 0 && setAberto(true)}
          onBlur={() => setTimeout(() => setAberto(false), 150)}
          placeholder="Buscar produto por nome ou código... (F2)"
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-verde-mata/30 focus:border-verde-mata transition-all"
          autoComplete="off"
        />
      </div>

      {aberto && resultados.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-border shadow-xl z-50 overflow-hidden">
          {resultados.map((p, i) => {
            const isFrac = p.podeFracionar && p.unidadeFracao && p.pesoUnidade;
            const precoInteiro = Number(p.precoVenda);
            const precoFrac = isFrac
              ? (p.precoFracao ? Number(p.precoFracao) : precoInteiro / Number(p.pesoUnidade))
              : null;
            const estoqueTotal = isFrac
              ? (Number(p.quantidade) * Number(p.pesoUnidade) - Number(p.saldoFracionado)).toFixed(0)
              : null;

            return (
              <div
                key={p.id}
                onMouseDown={() => adicionarAoCarrinho(p, "inteiro")}
                role="option"
                aria-selected={i === selecionado}
                className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/50 transition-colors border-b border-border last:border-0 cursor-pointer ${i === selecionado ? "bg-verde-mata/5" : ""}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">{p.nome}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.codigo}
                    {isFrac
                      ? <span className="ml-2 opacity-70">{Number(p.quantidade).toFixed(0)} {UNIDADE_LABEL[p.unidade]} · {estoqueTotal} {UNIDADE_LABEL[p.unidadeFracao!]}</span>
                      : <span className="ml-2 opacity-70">{Number(p.quantidade).toFixed(2)} {UNIDADE_LABEL[p.unidade]}</span>
                    }
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                  <div className="text-right">
                    <div className="text-sm font-semibold text-verde-mata">
                      R$ {precoInteiro.toFixed(2).replace(".", ",")}
                      <span className="font-normal text-muted-foreground text-xs ml-0.5">/{UNIDADE_LABEL[p.unidade]}</span>
                    </div>
                    {isFrac && (
                      <div className="text-xs text-muted-foreground">
                        R$ {precoFrac!.toFixed(2).replace(".", ",")}/{UNIDADE_LABEL[p.unidadeFracao!]}
                      </div>
                    )}
                  </div>
                  {isFrac && (
                    <button
                      onMouseDown={(e) => { e.stopPropagation(); adicionarAoCarrinho(p, "fracionado"); }}
                      className="text-xs bg-terra/10 text-terra border border-terra/20 rounded-lg px-2 py-1 hover:bg-terra/20 transition-colors whitespace-nowrap"
                    >
                      por {UNIDADE_LABEL[p.unidadeFracao!]}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <div className="px-4 py-2 bg-muted/30">
            <p className="text-xs text-muted-foreground">↑↓ navegar · Enter adiciona inteiro</p>
          </div>
        </div>
      )}
    </div>
  );
}
