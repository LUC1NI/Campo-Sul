"use client";

import { useState, useTransition } from "react";
import { parseDecimalBR } from "@/lib/venda-calculo";
import { ajustarEstoque } from "@/app/actions/produtos";
import { formatarQuantidade } from "@/lib/format";
import { Unidade } from "@prisma/client";
import { PackageCheck } from "lucide-react";
import { toast } from "sonner";

const UNIDADE_LABEL: Record<Unidade, string> = {
  UN: "Unidade",
  KG: "Kg",
  L: "Litro",
  SACO: "Saco",
  CX: "Caixa",
  M: "Metro",
};

interface AjusteEstoqueProps {
  produtoId: string;
  quantidadeAtual: number;
  unidade: Unidade;
  podeFracionar: boolean;
}

export function AjusteEstoque({
  produtoId,
  quantidadeAtual,
  unidade,
  podeFracionar,
}: AjusteEstoqueProps) {
  const [novaQuantidade, setNovaQuantidade] = useState(
    formatarQuantidade(quantidadeAtual, unidade, podeFracionar).replace(",", ".")
  );
  const [observacao, setObservacao] = useState("");
  const [isPending, startTransition] = useTransition();

  const qtdAtualFormatada = formatarQuantidade(quantidadeAtual, unidade, podeFracionar);
  const novaQtdNum = parseDecimalBR(novaQuantidade);
  const diff = isNaN(novaQtdNum) ? 0 : novaQtdNum - quantidadeAtual;
  const temAlteracao = !isNaN(novaQtdNum) && Math.abs(diff) > 0.0001;

  function handleSalvar() {
    if (!temAlteracao) return;
    startTransition(async () => {
      try {
        const result = await ajustarEstoque(produtoId, {
          novaQuantidade: String(novaQtdNum),
          observacao: observacao.trim() || undefined,
        });
        if (result.ok) {
          toast.success("Estoque ajustado com sucesso");
        } else {
          toast.error(result.error);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao ajustar estoque");
      }
    });
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-white p-5">
      <div className="flex items-center gap-2">
        <PackageCheck className="h-4 w-4 text-verde-mata" />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Ajuste de Estoque
        </h2>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-3">
        <span className="text-sm text-muted-foreground">Estoque atual</span>
        <span className="font-semibold text-foreground">
          {qtdAtualFormatada} {UNIDADE_LABEL[unidade]}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-foreground/70">
            Nova quantidade *
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={novaQuantidade}
              onChange={(e) => setNovaQuantidade(e.target.value)}
              className="flex-1 rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm transition-all focus:border-verde-mata focus:outline-none focus:ring-2 focus:ring-verde-mata/30"
              placeholder="0"
            />
            <span className="whitespace-nowrap text-sm text-muted-foreground">
              {UNIDADE_LABEL[unidade]}
            </span>
          </div>
          {temAlteracao && (
            <p
              className={`mt-1.5 text-xs font-medium ${diff > 0 ? "text-verde-mata" : "text-destructive"}`}
            >
              {diff > 0 ? "+" : ""}
              {formatarQuantidade(diff, unidade, podeFracionar).replace(",", ".")}{" "}
              {UNIDADE_LABEL[unidade]}
            </p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-foreground/70">Observação</label>
          <input
            type="text"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Motivo do ajuste..."
            className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm transition-all focus:border-verde-mata focus:outline-none focus:ring-2 focus:ring-verde-mata/30"
          />
        </div>
      </div>

      <button
        onClick={handleSalvar}
        disabled={isPending || !temAlteracao}
        className="flex items-center gap-2 rounded-lg bg-verde-mata px-5 py-2.5 font-medium text-white transition-colors hover:bg-verde-claro disabled:opacity-50"
      >
        {isPending ? "Salvando..." : "Salvar ajuste"}
      </button>
    </section>
  );
}
