"use client";

import { useCarrinho, MetodoPagamento } from "@/stores/carrinho-store";
import { Plus, X, Tag } from "lucide-react";
import { useState } from "react";
import { nanoid } from "./utils";

const METODOS: { value: MetodoPagamento; label: string }[] = [
  { value: "DINHEIRO", label: "Dinheiro" },
  { value: "DEBITO", label: "Débito" },
  { value: "CREDITO", label: "Crédito" },
  { value: "PIX", label: "PIX" },
];

const fmt = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

export function PainelPagamento() {
  const { pagamentos, adicionarPagamento, removerPagamento, setDesconto, desconto, subtotal, total, totalPago, troco } =
    useCarrinho();
  const [metodoSelecionado, setMetodoSelecionado] = useState<MetodoPagamento>("DINHEIRO");
  const [valorInput, setValorInput] = useState("");
  const [editandoDesconto, setEditandoDesconto] = useState(false);
  const [descontoInput, setDescontoInput] = useState("");

  function handleAdicionarPagamento() {
    const valor = parseFloat(valorInput.replace(",", "."));
    if (isNaN(valor) || valor <= 0) return;
    adicionarPagamento({ id: nanoid(), metodo: metodoSelecionado, valor });
    setValorInput("");
  }

  function aplicarDesconto() {
    const val = parseFloat(descontoInput.replace(",", "."));
    setDesconto(isNaN(val) || val < 0 ? 0 : val);
    setEditandoDesconto(false);
  }

  function removerDesconto() {
    setDesconto(0);
    setDescontoInput("");
  }

  function abrirDesconto() {
    setDescontoInput(desconto > 0 ? desconto.toFixed(2).replace(".", ",") : "");
    setEditandoDesconto(true);
  }

  const falta = total() - totalPago();

  return (
    <div className="bg-white rounded-xl border border-border p-4 space-y-4">
      <h2 className="font-semibold text-sm text-foreground">Pagamento</h2>

      {/* Seletor de método */}
      <div className="grid grid-cols-4 gap-1.5">
        {METODOS.map((m) => (
          <button
            key={m.value}
            onClick={() => setMetodoSelecionado(m.value)}
            className={`py-2 rounded-lg text-xs font-medium transition-all ${
              metodoSelecionado === m.value
                ? "bg-verde-mata text-white"
                : "border border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Valor + botão adicionar */}
      <div className="flex gap-2">
        <input
          type="text"
          value={valorInput}
          onChange={(e) => setValorInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdicionarPagamento()}
          placeholder={`R$ ${falta > 0 ? falta.toFixed(2).replace(".", ",") : "0,00"}`}
          className="flex-1 px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-verde-mata/30"
        />
        <button
          onClick={handleAdicionarPagamento}
          className="flex items-center gap-1 bg-verde-mata hover:bg-verde-claro text-white px-3 py-2 rounded-lg text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Lista de pagamentos */}
      {pagamentos.length > 0 && (
        <div className="space-y-1.5">
          {pagamentos.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {METODOS.find((m) => m.value === p.metodo)?.label}
              </span>
              <div className="flex items-center gap-2">
                <span className="font-medium">{fmt(p.valor)}</span>
                <button
                  onClick={() => removerPagamento(p.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Totais */}
      <div className="border-t border-border pt-3 space-y-2">

        {/* Subtotal */}
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className={desconto > 0 ? "text-muted-foreground line-through" : "font-medium"}>
            {fmt(subtotal())}
          </span>
        </div>

        {/* Desconto — inline editable */}
        {editandoDesconto ? (
          <div className="flex items-center gap-2">
            <Tag className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            <span className="text-xs text-muted-foreground flex-1">Desconto (R$)</span>
            <input
              autoFocus
              type="text"
              value={descontoInput}
              onChange={(e) => setDescontoInput(e.target.value)}
              onBlur={aplicarDesconto}
              onKeyDown={(e) => {
                if (e.key === "Enter") aplicarDesconto();
                if (e.key === "Escape") setEditandoDesconto(false);
              }}
              className="w-24 px-2 py-1 rounded-lg border border-amber-300 text-sm text-right focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
              placeholder="0,00"
            />
            <button
              onClick={() => setEditandoDesconto(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex justify-between items-center text-sm">
            <button
              onClick={abrirDesconto}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-amber-600 transition-colors group"
            >
              <Tag className="w-3.5 h-3.5 group-hover:text-amber-500" />
              <span className="text-xs">Desconto</span>
            </button>
            {desconto > 0 ? (
              <div className="flex items-center gap-2">
                <span className="text-amber-600 font-medium text-sm">
                  − {fmt(desconto)}
                </span>
                <button
                  onClick={removerDesconto}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  title="Remover desconto"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground/50 italic">nenhum</span>
            )}
          </div>
        )}

        {/* Total a pagar */}
        <div className="flex justify-between items-center pt-1 border-t border-border">
          <span className="font-semibold text-sm">Total</span>
          <span className="font-bold text-base text-verde-mata">{fmt(total())}</span>
        </div>

        {/* Pago */}
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Pago</span>
          <span className={`font-semibold ${totalPago() >= total() ? "text-verde-mata" : "text-destructive"}`}>
            {fmt(totalPago())}
          </span>
        </div>

        {/* Troco */}
        {troco() > 0 && (
          <div className="flex justify-between text-sm">
            <span className="font-medium text-verde-mata">Troco</span>
            <span className="font-semibold text-verde-mata">{fmt(troco())}</span>
          </div>
        )}

        {/* Falta */}
        {falta > 0.01 && totalPago() > 0 && (
          <div className="flex justify-between text-sm">
            <span className="font-medium text-destructive">Falta</span>
            <span className="font-semibold text-destructive">{fmt(falta)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
