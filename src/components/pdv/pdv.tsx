"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useCarrinho } from "@/stores/carrinho-store";
import { BuscaProduto } from "./busca-produto";
import { Carrinho } from "./carrinho";
import { PainelPagamento } from "./painel-pagamento";
import { finalizarVenda, marcarErroPdf, FinalizarVendaInput } from "@/app/actions/vendas";
import { toast } from "sonner";
import { TipoDocumento } from "@prisma/client";
import { DialogFinalizacao } from "./dialog-finalizacao";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function PDV() {
  const carrinho = useCarrinho();
  const buscaRef = useRef<HTMLInputElement>(null);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [confirmarLimpar, setConfirmarLimpar] = useState(false);

  // Atalho F2 → foco na busca
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        buscaRef.current?.focus();
      }
      if (e.key === "F4" && carrinho.itens.length > 0) {
        e.preventDefault();
        setDialogAberto(true);
      }
      if (e.key === "Escape") {
        setDialogAberto(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [carrinho.itens.length]);

  const handleFinalizar = useCallback(
    async (tipoDocumento?: TipoDocumento, cpfCnpj?: string, nomeCliente?: string) => {
      if (carrinho.itens.length === 0) {
        toast.error("Adicione itens ao carrinho");
        return;
      }
      if (carrinho.pagamentos.length === 0) {
        toast.error("Informe o pagamento");
        return;
      }

      setFinalizando(true);
      try {
        const input: FinalizarVendaInput = {
          itens: carrinho.itens.map((item) => ({
            produtoId: item.produtoId,
            unidadeVenda: item.unidade,
            quantidade: item.quantidade,
            precoUnitario: item.precoUnitario,
            desconto: 0,
          })),
          pagamentos: carrinho.pagamentos.map((p) => ({
            metodo: p.metodo,
            valor: p.valor,
          })),
          desconto: carrinho.desconto,
          tipoDocumento,
          cpfCnpj,
          nomeCliente,
        };

        const resultado = await finalizarVenda(input);
        toast.success(`Venda #${resultado.numeroVenda} concluída!`);

        if (resultado.documentoId) {
          const tipo = tipoDocumento === "NOTA" ? "nota" : "recibo";
          try {
            const res = await fetch(`/api/pdf/${tipo}/${resultado.documentoId}`);
            if (res.ok) {
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              window.open(url, "_blank");
              setTimeout(() => URL.revokeObjectURL(url), 60_000);
            } else {
              await marcarErroPdf(resultado.documentoId, `HTTP ${res.status}`);
              toast.warning("Venda salva! O PDF não pôde ser gerado — acesse Notas para reemitir.");
            }
          } catch {
            await marcarErroPdf(resultado.documentoId, "Erro de rede ao gerar PDF");
            toast.warning("Venda salva! Erro de conexão ao gerar PDF — acesse Notas para reemitir.");
          }
        }

        carrinho.limparCarrinho();
        setDialogAberto(false);
        buscaRef.current?.focus();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao finalizar venda");
      } finally {
        setFinalizando(false);
      }
    },
    [carrinho]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header PDV */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-fraunces text-xl font-bold text-verde-mata">PDV — Ponto de Venda</h1>
          <p className="text-xs text-muted-foreground hidden sm:block">F2 = Buscar · F4 = Pagamento · Esc = Fechar</p>
        </div>
        {carrinho.itens.length > 0 && (
          <button
            onClick={() => setConfirmarLimpar(true)}
            className="text-xs text-destructive hover:underline"
          >
            Limpar carrinho
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 flex-1 min-h-0">
        {/* Coluna esquerda: busca + carrinho */}
        <div className="flex flex-col gap-4 min-h-0">
          <BuscaProduto inputRef={buscaRef} />
          <div className="flex-1 overflow-hidden">
            <Carrinho />
          </div>
        </div>

        {/* Coluna direita: pagamento */}
        <div className="flex flex-col gap-4">
          <PainelPagamento />
          <button
            disabled={carrinho.itens.length === 0 || finalizando}
            onClick={() => setDialogAberto(true)}
            className="w-full bg-verde-mata hover:bg-verde-claro disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl transition-colors text-lg"
          >
            {finalizando ? "Finalizando..." : `Finalizar — R$ ${carrinho.total().toFixed(2).replace(".", ",")}`}
            <span className="block text-xs font-normal opacity-75">F4</span>
          </button>
        </div>
      </div>

      <DialogFinalizacao
        aberto={dialogAberto}
        onFechar={() => setDialogAberto(false)}
        onConfirmar={handleFinalizar}
        finalizando={finalizando}
      />

      <ConfirmDialog
        aberto={confirmarLimpar}
        titulo="Limpar carrinho"
        descricao="Todos os itens adicionados serão removidos."
        labelConfirmar="Limpar"
        variante="destrutivo"
        onConfirmar={() => { carrinho.limparCarrinho(); setConfirmarLimpar(false); }}
        onCancelar={() => setConfirmarLimpar(false)}
      />
    </div>
  );
}
