"use client";

import { useState, useEffect, useRef } from "react";
import { X, Scale, Banknote, Package } from "lucide-react";
import { calcularQuantidadePorValor } from "@/lib/fracionamento";

type Unidade = "UN" | "KG" | "L" | "SACO" | "CX" | "M";

const UNIDADE_LABEL: Record<Unidade, string> = {
  UN: "un",
  KG: "kg",
  L: "L",
  SACO: "saco",
  CX: "cx",
  M: "m",
};

export interface ProdutoFracionadoInfo {
  nome: string;
  codigo: string;
  unidade: Unidade; // unidade fechada (ex: SACO)
  unidadeFracao: Unidade; // unidade fracionada (ex: KG)
  precoInteiro: number; // R$ / unidade fechada
  precoFracao: number; // R$ / unidade fracionada
  pesoUnidade: number; // ex: 25 (kg por saco)
  estoqueUnidades: number; // unidades fechadas em estoque
  saldoFracionado: number; // saldo aberto (em kg)
}

interface Props {
  aberto: boolean;
  produto: ProdutoFracionadoInfo | null;
  onFechar: () => void;
  onConfirmar: (quantidade: number, valorDigitado: number | null) => void;
}

export function DialogFracionado({ aberto, produto, onFechar, onConfirmar }: Props) {
  const [modo, setModo] = useState<"peso" | "valor">("peso");
  const [pesoInput, setPesoInput] = useState("");
  const [valorInput, setValorInput] = useState("");
  const pesoRef = useRef<HTMLInputElement>(null);
  const valorRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (aberto) {
      setModo("peso");
      setPesoInput("");
      setValorInput("");
      setTimeout(() => pesoRef.current?.focus(), 50);
    }
  }, [aberto]);

  if (!aberto || !produto) return null;

  const parse = (s: string) => {
    const n = parseFloat(s.replace(",", "."));
    return isNaN(n) || n <= 0 ? 0 : n;
  };

  const peso = modo === "peso" ? parse(pesoInput) : 0;
  const valor = modo === "valor" ? parse(valorInput) : 0;

  // Cálculo cruzado para mostrar o "outro lado" ao vivo
  const pesoCalculado =
    modo === "valor" && valor > 0 && produto.precoFracao > 0
      ? calcularQuantidadePorValor(valor, produto.precoFracao).toNumber()
      : peso;

  const valorCalculado =
    modo === "peso" && peso > 0 ? Number((peso * produto.precoFracao).toFixed(2)) : valor;

  const estoqueDisponivelKg =
    produto.estoqueUnidades * produto.pesoUnidade - produto.saldoFracionado;

  const podeConfirmar = pesoCalculado > 0;

  function confirmar() {
    if (!podeConfirmar) return;
    const qtd = Number(pesoCalculado.toFixed(4));
    const valorDigitado = modo === "valor" ? valor : null;
    onConfirmar(qtd, valorDigitado);
  }

  function trocarModo(novo: "peso" | "valor") {
    setModo(novo);
    setPesoInput("");
    setValorInput("");
    setTimeout(() => {
      if (novo === "peso") pesoRef.current?.focus();
      else valorRef.current?.focus();
    }, 50);
  }

  const unidadeLabel = UNIDADE_LABEL[produto.unidadeFracao];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onFechar} />

      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <button
          onClick={onFechar}
          className="absolute right-4 top-4 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="border-b border-border px-6 pb-4 pt-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-terra/10 text-terra">
              <Package className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 pr-6">
              <h2 className="text-lg font-semibold leading-tight text-foreground">
                {produto.nome}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Cód. {produto.codigo} · venda fracionada
              </p>
            </div>
          </div>

          {/* Info do produto */}
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-muted/40 px-2 py-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Preço</p>
              <p className="mt-0.5 text-sm font-semibold text-verde-mata">
                R$ {produto.precoFracao.toFixed(2).replace(".", ",")}
              </p>
              <p className="text-[10px] text-muted-foreground">/ {unidadeLabel}</p>
            </div>
            <div className="rounded-lg bg-muted/40 px-2 py-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Unidade</p>
              <p className="mt-0.5 text-sm font-semibold text-foreground">
                {produto.pesoUnidade.toFixed(0)} {unidadeLabel}
              </p>
              <p className="text-[10px] text-muted-foreground">
                / {UNIDADE_LABEL[produto.unidade]}
              </p>
            </div>
            <div className="rounded-lg bg-muted/40 px-2 py-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Estoque</p>
              <p className="mt-0.5 text-sm font-semibold text-foreground">
                ≈ {estoqueDisponivelKg.toFixed(0)} {unidadeLabel}
              </p>
              <p className="text-[10px] text-muted-foreground">disponível</p>
            </div>
          </div>
        </div>

        {/* Tabs modo */}
        <div className="px-6 pt-5">
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/40 p-1">
            <button
              onClick={() => trocarModo("peso")}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                modo === "peso"
                  ? "bg-white text-verde-mata shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Scale className="h-4 w-4" />
              Digitar {unidadeLabel}
            </button>
            <button
              onClick={() => trocarModo("valor")}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                modo === "valor"
                  ? "bg-white text-verde-mata shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Banknote className="h-4 w-4" />
              Digitar R$
            </button>
          </div>
        </div>

        {/* Inputs */}
        <div className="px-6 py-5">
          {modo === "peso" ? (
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Quanto o cliente quer levar?
              </label>
              <div className="mt-2 flex items-center gap-2 rounded-xl border-2 border-verde-mata/40 px-4 py-3 transition-colors focus-within:border-verde-mata">
                <input
                  ref={pesoRef}
                  type="text"
                  inputMode="decimal"
                  value={pesoInput}
                  onChange={(e) => setPesoInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmar();
                    if (e.key === "Escape") onFechar();
                  }}
                  placeholder="0,000"
                  className="flex-1 bg-transparent text-2xl font-semibold text-foreground focus:outline-none"
                />
                <span className="text-lg text-muted-foreground">{unidadeLabel}</span>
              </div>
              <div className="mt-3 flex items-center justify-between rounded-lg border border-terra/15 bg-terra/5 px-4 py-3">
                <span className="text-sm text-muted-foreground">Vai dar</span>
                <span className="text-lg font-semibold text-terra">
                  R$ {valorCalculado.toFixed(2).replace(".", ",")}
                </span>
              </div>
            </div>
          ) : (
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Quanto o cliente quer gastar?
              </label>
              <div className="mt-2 flex items-center gap-2 rounded-xl border-2 border-verde-mata/40 px-4 py-3 transition-colors focus-within:border-verde-mata">
                <span className="text-lg text-muted-foreground">R$</span>
                <input
                  ref={valorRef}
                  type="text"
                  inputMode="decimal"
                  value={valorInput}
                  onChange={(e) => setValorInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmar();
                    if (e.key === "Escape") onFechar();
                  }}
                  placeholder="0,00"
                  className="flex-1 bg-transparent text-2xl font-semibold text-foreground focus:outline-none"
                />
              </div>
              <div className="mt-3 flex items-center justify-between rounded-lg border border-terra/15 bg-terra/5 px-4 py-3">
                <span className="text-sm text-muted-foreground">Equivale a</span>
                <span className="text-lg font-semibold text-terra">
                  {pesoCalculado.toFixed(3).replace(".", ",")} {unidadeLabel}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onFechar}
            className="flex-1 rounded-xl border border-border py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={!podeConfirmar}
            className="flex-1 rounded-xl bg-verde-mata py-3 text-sm font-semibold text-white transition-colors hover:bg-verde-mata/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Adicionar ao carrinho
          </button>
        </div>
      </div>
    </div>
  );
}
