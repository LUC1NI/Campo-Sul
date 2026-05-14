"use client";

import { useCarrinho, MetodoPagamento } from "@/stores/carrinho-store";
import { Plus, X, Tag, Banknote, CreditCard, Smartphone } from "lucide-react";
import { useState, useRef, useImperativeHandle, forwardRef } from "react";
import { nanoid } from "./utils";

export interface PainelPagamentoHandle {
  abrirDesconto: () => void;
}

const METODOS: { value: MetodoPagamento; label: string; icon: React.ReactNode }[] = [
  { value: "DINHEIRO", label: "Dinheiro", icon: <Banknote className="w-3.5 h-3.5" /> },
  { value: "DEBITO",   label: "Débito",   icon: <CreditCard className="w-3.5 h-3.5" /> },
  { value: "CREDITO",  label: "Crédito",  icon: <CreditCard className="w-3.5 h-3.5" /> },
  { value: "PIX",      label: "PIX",      icon: <Smartphone className="w-3.5 h-3.5" /> },
];

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const PainelPagamento = forwardRef<PainelPagamentoHandle>(function PainelPagamento(_, ref) {
  const {
    pagamentos, adicionarPagamento, removerPagamento,
    setDesconto, desconto, subtotal, total, totalPago, troco,
  } = useCarrinho();

  const [metodoSelecionado, setMetodoSelecionado] = useState<MetodoPagamento>("DINHEIRO");
  const [valorInput, setValorInput] = useState("");
  const [editandoDesconto, setEditandoDesconto] = useState(false);
  const [descontoInput, setDescontoInput] = useState("");
  const descontoInputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    abrirDesconto() {
      setDescontoInput(desconto > 0 ? desconto.toFixed(2).replace(".", ",") : "");
      setEditandoDesconto(true);
      setTimeout(() => descontoInputRef.current?.focus(), 0);
    },
  }));

  const falta = Math.max(0, total() - totalPago());
  const isDinheiro = metodoSelecionado === "DINHEIRO";

  function handleAdicionarDinheiro() {
    const valor = parseFloat(valorInput.replace(",", "."));
    if (isNaN(valor) || valor <= 0) return;
    adicionarPagamento({ id: nanoid(), metodo: metodoSelecionado, valor });
    setValorInput("");
  }

  function handleConfirmarExato() {
    if (falta <= 0.009) return;
    adicionarPagamento({ id: nanoid(), metodo: metodoSelecionado, valor: parseFloat(falta.toFixed(2)) });
  }

  function aplicarDesconto() {
    const val = parseFloat(descontoInput.replace(",", "."));
    setDesconto(isNaN(val) || val < 0 ? 0 : val);
    setEditandoDesconto(false);
  }

  function abrirDesconto() {
    setDescontoInput(desconto > 0 ? desconto.toFixed(2).replace(".", ",") : "");
    setEditandoDesconto(true);
  }

  const totalVal = total();
  const totalPagoVal = totalPago();
  const trocoVal = troco();
  const subtotalVal = subtotal();
  const quitado = totalPagoVal >= totalVal - 0.009;

  return (
    <div className="bg-white rounded-xl border border-border p-3 space-y-3">
      <h2 className="font-semibold text-sm text-foreground">Pagamento</h2>

      {/* Seletor de método */}
      <div className="grid grid-cols-4 gap-1.5">
        {METODOS.map((m) => (
          <button
            key={m.value}
            onClick={() => setMetodoSelecionado(m.value)}
            className={`flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg text-xs font-medium transition-all ${
              metodoSelecionado === m.value
                ? "bg-verde-mata text-white shadow-sm"
                : "border border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {m.icon}
            {m.label}
          </button>
        ))}
      </div>

      {/* Área de entrada — condicional por método */}
      {isDinheiro ? (
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={valorInput}
            onChange={(e) => setValorInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdicionarDinheiro()}
            placeholder={`R$ ${falta > 0 ? falta.toFixed(2).replace(".", ",") : "0,00"}`}
            suppressHydrationWarning
            className="flex-1 px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-verde-mata/30"
          />
          <button
            onClick={handleAdicionarDinheiro}
            className="flex items-center gap-1 bg-verde-mata hover:bg-verde-claro text-white px-3 py-2 rounded-lg text-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={handleConfirmarExato}
          disabled={falta <= 0.009}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-lg font-medium text-sm transition-all ${
            falta > 0.009
              ? "bg-verde-mata/10 hover:bg-verde-mata/20 text-verde-mata border border-verde-mata/30"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          }`}
        >
          <span>Confirmar {METODOS.find((m) => m.value === metodoSelecionado)?.label}</span>
          <span className="font-bold">{fmt(falta)}</span>
        </button>
      )}

      {/* Lista de pagamentos adicionados */}
      {pagamentos.length > 0 && (
        <div className="space-y-1">
          {pagamentos.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-sm bg-muted/40 px-3 py-1.5 rounded-lg">
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
          <span suppressHydrationWarning className={desconto > 0 ? "text-muted-foreground line-through text-xs" : "font-medium"}>
            {fmt(subtotalVal)}
          </span>
        </div>

        {/* Desconto */}
        {editandoDesconto ? (
          <div className="flex items-center gap-2">
            <Tag className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            <span className="text-xs text-muted-foreground flex-1">Desconto (R$)</span>
            <input
              ref={descontoInputRef}
              autoFocus
              type="text"
              inputMode="decimal"
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
            <button onClick={() => setEditandoDesconto(false)} className="text-muted-foreground hover:text-foreground">
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
                <span className="text-amber-600 font-medium text-sm">− {fmt(desconto)}</span>
                <button onClick={() => { setDesconto(0); setDescontoInput(""); }} className="text-muted-foreground hover:text-destructive">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground/50 italic">nenhum</span>
            )}
          </div>
        )}

        {/* TOTAL — destaque principal */}
        <div className="flex justify-between items-center bg-verde-mata text-white px-4 py-2.5 rounded-xl">
          <span className="font-bold text-sm uppercase tracking-wide">Total</span>
          <span suppressHydrationWarning className="font-bold text-2xl font-fraunces">{fmt(totalVal)}</span>
        </div>

        {/* Pago */}
        {pagamentos.length > 0 && (
          <div className={`flex justify-between items-center px-3 py-2 rounded-lg text-sm ${
            quitado ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"
          }`}>
            <span className="font-medium">Pago</span>
            <span suppressHydrationWarning className="font-semibold">{fmt(totalPagoVal)}</span>
          </div>
        )}

        {/* Falta */}
        {falta > 0.009 && totalPagoVal > 0 && (
          <div className="flex justify-between items-center px-4 py-2 rounded-xl bg-red-50 border border-red-200">
            <span className="font-bold text-red-600 text-sm">Falta</span>
            <span suppressHydrationWarning className="font-bold text-red-600 text-xl font-fraunces">{fmt(falta)}</span>
          </div>
        )}

        {/* Troco */}
        {trocoVal > 0.009 && (
          <div className="flex justify-between items-center px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200">
            <span className="font-bold text-emerald-600 text-sm">Troco</span>
            <span suppressHydrationWarning className="font-bold text-emerald-600 text-xl font-fraunces">{fmt(trocoVal)}</span>
          </div>
        )}
      </div>
    </div>
  );
});
