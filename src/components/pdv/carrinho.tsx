"use client";

import { useCarrinho } from "@/stores/carrinho-store";
import { Trash2, ShoppingCart, Plus, Minus } from "lucide-react";
import { Unidade } from "@prisma/client";
import { useState } from "react";
import { calcularQuantidadePorValor } from "@/lib/fracionamento";

const UNIDADE_LABEL: Record<Unidade, string> = {
  UN: "un", KG: "kg", L: "L", SACO: "saco", CX: "cx", M: "m",
};

export function Carrinho() {
  const { itens, removerItem, atualizarQuantidade, subtotal, desconto } = useCarrinho();

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
            key={item.produtoId}
            item={item}
            onRemover={() => removerItem(item.produtoId)}
            onAtualizarQtd={(q) => atualizarQuantidade(item.produtoId, q)}
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
}: {
  item: import("@/stores/carrinho-store").ItemCarrinho;
  onRemover: () => void;
  onAtualizarQtd: (q: number) => void;
}) {
  const [editandoValor, setEditandoValor] = useState(false);
  const [valorInput, setValorInput] = useState("");

  function handleValorConfirm() {
    const valor = parseFloat(valorInput.replace(",", "."));
    if (!isNaN(valor) && valor > 0 && item.precoUnitario > 0) {
      try {
        const qtd = calcularQuantidadePorValor(valor, item.precoUnitario);
        onAtualizarQtd(qtd.toNumber());
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
        </p>

        {/* Controle de quantidade */}
        <div className="flex items-center gap-2 mt-2">
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

          {/* Botão "por valor" para produtos fracionáveis */}
          {item.podeFracionar && (
            <button
              onClick={() => setEditandoValor(true)}
              className="text-xs text-verde-claro hover:underline ml-1"
            >
              por R$
            </button>
          )}
        </div>

        {editandoValor && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">R$</span>
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
              className="w-20 text-sm border border-verde-mata rounded px-2 py-0.5 focus:outline-none"
              placeholder="10,00"
            />
            <span className="text-xs text-muted-foreground">→ qtd automática</span>
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
