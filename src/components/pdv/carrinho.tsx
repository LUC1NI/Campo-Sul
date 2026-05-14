"use client";

import { useCarrinho } from "@/stores/carrinho-store";
import { Trash2, ShoppingCart, Plus, Minus } from "lucide-react";
import { useState } from "react";

type Unidade = "UN" | "KG" | "L" | "SACO" | "CX" | "M";
import { calcularQuantidadePorValor } from "@/lib/fracionamento";

const UNIDADE_LABEL: Record<Unidade, string> = {
  UN: "un", KG: "kg", L: "L", SACO: "saco", CX: "cx", M: "m",
};

export function Carrinho() {
  const { itens, removerItem, atualizarQuantidade, atualizarQuantidadePorValor, subtotal, desconto } = useCarrinho();

  if (itens.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-dashed border-border h-full flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-20" />
          <p className="text-sm">Carrinho vazio</p>
          <p className="text-xs opacity-60 mt-1">Busque um produto acima</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-border h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto divide-y divide-border scrollbar-thin">
        {itens.map((item) => (
          <ItemCarrinhoRow
            key={item.id}
            item={item}
            onRemover={() => removerItem(item.id)}
            onAtualizarQtd={(q) => atualizarQuantidade(item.id, q)}
            onAtualizarQtdPorValor={(q, v) => atualizarQuantidadePorValor(item.id, q, v)}
          />
        ))}
      </div>

      <div className="px-4 py-3 border-t border-border bg-muted/30 space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span>R$ {subtotal().toFixed(2).replace(".", ",")}</span>
        </div>
        {desconto > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Desconto</span>
            <span className="text-destructive">- R$ {desconto.toFixed(2).replace(".", ",")}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ItemCarrinhoRow({
  item,
  onRemover,
  onAtualizarQtd,
  onAtualizarQtdPorValor,
}: {
  item: import("@/stores/carrinho-store").ItemCarrinho;
  onRemover: () => void;
  onAtualizarQtd: (q: number) => void;
  onAtualizarQtdPorValor: (q: number, valorReais: number) => void;
}) {
  const [editandoValor, setEditandoValor] = useState(false);
  const [valorInput, setValorInput] = useState("");

  const isFracionado = item.podeFracionar && item.unidade !== item.unidadeEstoque;
  const unidadePeso = item.unidade === "KG" || item.unidade === "L" || item.unidade === "M";
  const podeDigitarReais = isFracionado && unidadePeso;

  // Preview ao vivo da quantidade calculada pelo valor digitado
  const previewQtd = (() => {
    if (!editandoValor || !valorInput) return null;
    const valor = parseFloat(valorInput.replace(",", "."));
    if (isNaN(valor) || valor <= 0 || item.precoUnitario <= 0) return null;
    try {
      return calcularQuantidadePorValor(valor, item.precoUnitario);
    } catch {
      return null;
    }
  })();

  function handleValorConfirm() {
    const valor = parseFloat(valorInput.replace(",", "."));
    if (!isNaN(valor) && valor > 0 && item.precoUnitario > 0) {
      try {
        const qtd = calcularQuantidadePorValor(valor, item.precoUnitario);
        onAtualizarQtdPorValor(qtd.toNumber(), valor);
      } catch {
        // ignora
      }
    }
    setEditandoValor(false);
    setValorInput("");
  }

  const step = item.unidade === "KG" || item.unidade === "L" || item.unidade === "M" ? 0.1 : 1;

  return (
    <div className="px-4 py-3 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{item.nome}</p>
        <p className="text-xs text-muted-foreground">
          R$ {item.precoUnitario.toFixed(2).replace(".", ",")} / {UNIDADE_LABEL[item.unidade]}
          {isFracionado && <span className="ml-1 text-terra/70">• fracionado</span>}
          {!isFracionado && item.podeFracionar && <span className="ml-1 text-verde-claro/70">• inteiro</span>}
        </p>
        {item.valorDigitado != null && (
          <p className="text-xs mt-0.5">
            <span className="bg-terra/10 text-terra rounded px-1.5 py-0.5 font-medium">
              R$ {item.valorDigitado.toFixed(2).replace(".", ",")} → {item.quantidade.toFixed(3).replace(".", ",")} {UNIDADE_LABEL[item.unidade]}
            </span>
          </p>
        )}

        {/* Controle de quantidade */}
        {!editandoValor ? (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <button
              onClick={() => onAtualizarQtd(Number((item.quantidade - step).toFixed(4)))}
              className="w-6 h-6 rounded border border-border flex items-center justify-center hover:bg-muted transition-colors"
            >
              <Minus className="w-3 h-3" />
            </button>

            <input
              type="number"
              value={item.quantidade}
              step={step}
              min={step}
              onChange={(e) => onAtualizarQtd(parseFloat(e.target.value) || step)}
              className="w-16 text-center text-sm border border-border rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-verde-mata"
            />
            <span className="text-xs text-muted-foreground">{UNIDADE_LABEL[item.unidade]}</span>

            <button
              onClick={() => onAtualizarQtd(Number((item.quantidade + step).toFixed(4)))}
              className="w-6 h-6 rounded border border-border flex items-center justify-center hover:bg-muted transition-colors"
            >
              <Plus className="w-3 h-3" />
            </button>

            {podeDigitarReais && (
              <button
                onClick={() => setEditandoValor(true)}
                className="text-xs bg-terra/10 text-terra hover:bg-terra/20 px-2 py-0.5 rounded transition-colors ml-1"
              >
                digitar R$
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1 mt-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">R$</span>
              <input
                autoFocus
                type="text"
                value={valorInput}
                onChange={(e) => setValorInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleValorConfirm();
                  if (e.key === "Escape") { setEditandoValor(false); setValorInput(""); }
                }}
                onBlur={handleValorConfirm}
                className="w-24 text-sm border border-terra rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-terra/30"
                placeholder="10,00"
              />
              <button
                onClick={() => { setEditandoValor(false); setValorInput(""); }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
            {previewQtd ? (
              <span className="text-xs text-terra font-medium">
                ≈ {previewQtd.toFixed(3).replace(".", ",")} {UNIDADE_LABEL[item.unidade]}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                digite o valor em reais
              </span>
            )}
          </div>
        )}
      </div>

      <div className="text-right flex-shrink-0">
        <p className="text-sm font-semibold text-foreground">
          R$ {item.subtotal.toFixed(2).replace(".", ",")}
        </p>
        <button
          onClick={onRemover}
          className="text-destructive hover:opacity-70 transition-opacity mt-1"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
