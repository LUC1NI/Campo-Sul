"use client";

import { useState, useTransition } from "react";
import { ajustarEstoque } from "@/app/actions/produtos";
import { formatarQuantidade } from "@/lib/format";
import { Unidade } from "@prisma/client";
import { PackageCheck } from "lucide-react";
import { toast } from "sonner";

const UNIDADE_LABEL: Record<Unidade, string> = {
  UN: "Unidade", KG: "Kg", L: "Litro", SACO: "Saco", CX: "Caixa", M: "Metro",
};

interface AjusteEstoqueProps {
  produtoId: string;
  nomeProduto: string;
  quantidadeAtual: number;
  unidade: Unidade;
  podeFracionar: boolean;
}

export function AjusteEstoque({ produtoId, nomeProduto, quantidadeAtual, unidade, podeFracionar }: AjusteEstoqueProps) {
  const [novaQuantidade, setNovaQuantidade] = useState(
    formatarQuantidade(quantidadeAtual, unidade, podeFracionar).replace(",", ".")
  );
  const [observacao, setObservacao] = useState("");
  const [isPending, startTransition] = useTransition();

  const qtdAtualFormatada = formatarQuantidade(quantidadeAtual, unidade, podeFracionar);
  const novaQtdNum = parseFloat(novaQuantidade.replace(",", "."));
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
    <section className="bg-white rounded-xl border border-border p-5 space-y-4">
      <div className="flex items-center gap-2">
        <PackageCheck className="w-4 h-4 text-verde-mata" />
        <h2 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
          Ajuste de Estoque
        </h2>
      </div>

      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
        <span className="text-sm text-muted-foreground">Estoque atual</span>
        <span className="font-semibold text-foreground">
          {qtdAtualFormatada} {UNIDADE_LABEL[unidade]}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-foreground/70 mb-1.5">
            Nova quantidade *
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={novaQuantidade}
              onChange={(e) => setNovaQuantidade(e.target.value)}
              className="flex-1 px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-verde-mata/30 focus:border-verde-mata transition-all"
              placeholder="0"
            />
            <span className="text-sm text-muted-foreground whitespace-nowrap">{UNIDADE_LABEL[unidade]}</span>
          </div>
          {temAlteracao && (
            <p className={`text-xs mt-1.5 font-medium ${diff > 0 ? "text-verde-mata" : "text-destructive"}`}>
              {diff > 0 ? "+" : ""}{formatarQuantidade(diff, unidade, podeFracionar).replace(",", ".")} {UNIDADE_LABEL[unidade]}
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground/70 mb-1.5">
            Observação
          </label>
          <input
            type="text"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Motivo do ajuste..."
            className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-verde-mata/30 focus:border-verde-mata transition-all"
          />
        </div>
      </div>

      <button
        onClick={handleSalvar}
        disabled={isPending || !temAlteracao}
        className="flex items-center gap-2 bg-verde-mata hover:bg-verde-claro text-white font-medium px-5 py-2.5 rounded-lg transition-colors disabled:opacity-50"
      >
        {isPending ? "Salvando..." : "Salvar ajuste"}
      </button>
    </section>
  );
}
