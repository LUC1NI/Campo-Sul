"use client";

import { useState, useRef, useCallback, RefObject } from "react";
import { useCarrinho } from "@/stores/carrinho-store";
import { Search } from "lucide-react";
import { Unidade } from "@prisma/client";
import { useDebounce } from "@/hooks/use-debounce";
import { useEffect } from "react";

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

  const adicionarAoCarrinho = useCallback(
    (p: ProdutoBusca) => {
      const unidade = p.podeFracionar && p.unidadeFracao ? p.unidadeFracao : p.unidade;
      carrinhoStore.adicionarItem({
        produtoId: p.id,
        nome: p.nome,
        codigo: p.codigo,
        unidade,
        unidadeEstoque: p.unidade,
        precoUnitario: parseFloat(String(p.precoVenda)),
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
    fetch(`/api/produtos/buscar?q=${encodeURIComponent(debouncedQuery)}`)
      .then((r) => r.json())
      .then((data: ProdutoBusca[]) => {
        // Leitora de código de barras: digita EAN + Enter antes do debounce.
        // Se volta 1 resultado e a query parece um código de barras (só dígitos,
        // 8–14 chars), adiciona direto sem precisar de Enter.
        const pareceCodigoBarras = /^\d{8,14}$/.test(debouncedQuery);
        if (data.length === 1 && pareceCodigoBarras) {
          adicionarAoCarrinho(data[0]);
        } else {
          setResultados(data);
          setAberto(data.length > 0);
          setSelecionado(0);
        }
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
      if (resultados[selecionado]) adicionarAoCarrinho(resultados[selecionado]);
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
          {resultados.map((p, i) => (
            <button
              key={p.id}
              onMouseDown={() => adicionarAoCarrinho(p)}
              className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/50 transition-colors ${
                i === selecionado ? "bg-verde-mata/5" : ""
              }`}
            >
              <div>
                <div className="text-sm font-medium text-foreground">{p.nome}</div>
                <div className="text-xs text-muted-foreground">
                  {p.codigo}
                  {p.podeFracionar && p.unidadeFracao && (
                    <span className="ml-2 text-terra">• vende por {UNIDADE_LABEL[p.unidadeFracao]}</span>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0 ml-4">
                <div className="text-sm font-semibold text-verde-mata">
                  R$ {Number(p.precoVenda).toFixed(2).replace(".", ",")}
                </div>
                <div className="text-xs text-muted-foreground">
                  {Number(p.quantidade).toFixed(2)} {UNIDADE_LABEL[p.unidade]} estoque
                </div>
              </div>
            </button>
          ))}
          <div className="px-4 py-2 border-t border-border bg-muted/30">
            <p className="text-xs text-muted-foreground">Enter para adicionar · ↑↓ para navegar</p>
          </div>
        </div>
      )}
    </div>
  );
}
