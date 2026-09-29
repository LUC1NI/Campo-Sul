"use client";

import { useCarrinho } from "@/stores/carrinho-store";
import { parseDecimalBR } from "@/lib/venda-calculo";
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
          <p className="text-xs mt-1">Busque um produto acima</p>
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
  const [qtdTexto, setQtdTexto] = useState<string | null>(null); // null = mostrando o valor da store

  const isFracionado = item.podeFracionar && item.unidade !== item.unidadeEstoque;
  const unidadePeso = item.unidade === "KG" || item.unidade === "L" || item.unidade === "M";
  const podeDigitarReais = isFracionado && unidadePeso;

  // Preview ao vivo da quantidade calculada pelo valor digitado
  const previewQtd = (() => {
    if (!editandoValor || !valorInput) return null;
    const valor = parseDecimalBR(valorInput);
    if (isNaN(valor) || valor <= 0 || item.precoUnitario <= 0) return null;
    try {
      return calcularQuantidadePorValor(valor, item.precoUnitario);
    } catch {
      return null;
    }
  })();

  function handleValorConfirm() {
    const valor = parseDecimalBR(valorInput);
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

  function commitQtd() {
    if (qtdTexto === null) return;
    const q = parseDecimalBR(qtdTexto);
    if (!isNaN(q) && q > 0) onAtualizarQtd(Number(q.toFixed(4)));
    setQtdTexto(null);
  }
  const btnQtd =
    "w-9 h-9 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="px-4 py-3 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{item.nome}</p>
        <p className="text-xs text-muted-foreground">
          R$ {item.precoUnitario.toFixed(2).replace(".", ",")} / {UNIDADE_LABEL[item.unidade]}
          {isFracionado && <span className="ml-1 text-terra">• fracionado</span>}
          {!isFracionado && item.podeFracionar && <span className="ml-1 text-verde-mata">• inteiro</span>}
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
              disabled={item.quantidade - step <= 0}
              aria-label={`Diminuir quantidade de ${item.nome}`}
              className={btnQtd}
            >
              <Minus className="w-4 h-4" />
            </button>

            <input
              type="text"
              inputMode="decimal"
              aria-label={`Quantidade de ${item.nome}`}
              value={qtdTexto ?? String(item.quantidade).replace(".", ",")}
              onChange={(e) => setQtdTexto(e.target.value)}
              onBlur={commitQtd}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitQtd();
                if (e.key === "Escape") setQtdTexto(null);
              }}
              className="w-20 h-9 text-center text-sm border border-border rounded-lg px-1 focus:outline-none focus:ring-2 focus:ring-verde-mata/40"
            />
            <span className="text-xs text-muted-foreground">{UNIDADE_LABEL[item.unidade]}</span>

            <button
              onClick={() => onAtualizarQtd(Number((item.quantidade + step).toFixed(4)))}
              aria-label={`Aumentar quantidade de ${item.nome}`}
              className={btnQtd}
            >
              <Plus className="w-4 h-4" />
            </button>

            {podeDigitarReais && (
              <button
                onClick={() => setEditandoValor(true)}
                className="text-xs bg-terra/10 text-terra hover:bg-terra/20 px-3 h-9 rounded-lg transition-colors ml-1"
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
                aria-label="Cancelar valor em reais"
                className="p-2 text-xs text-muted-foreground hover:text-foreground"
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
          aria-label={`Remover ${item.nome} do carrinho`}
          className="text-destructive hover:bg-destructive/10 rounded-lg p-2 -mr-2 transition-colors mt-1"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
