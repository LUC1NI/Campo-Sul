"use client";

import { useState } from "react";
import { emitirNotaFiscal } from "@/app/actions/vendas";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { marcarErroPdf } from "@/app/actions/vendas";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface BotaoEmitirNFProps {
  documentoId: string;
  numeroRecibo: number;
}

export function BotaoEmitirNF({ documentoId, numeroRecibo }: BotaoEmitirNFProps) {
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);

  async function confirmar() {
    setAberto(false);
    setCarregando(true);
    try {
      const id = await emitirNotaFiscal(documentoId);
      toast.success("Recibo convertido para Nota Fiscal!");

      const res = await fetch(`/api/pdf/nota/${id}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else {
        await marcarErroPdf(id, `HTTP ${res.status}`);
        toast.warning("NF emitida, mas o PDF falhou — acesse Notas para reemitir.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao emitir nota fiscal");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        disabled={carregando}
        className="inline-flex items-center gap-1 text-xs text-verde-claro hover:underline font-medium disabled:opacity-50"
        title={`Emitir NF para o recibo Nº ${String(numeroRecibo).padStart(6, "0")}`}
      >
        {carregando ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
        {carregando ? "Emitindo..." : "Emitir NF"}
      </button>

      <ConfirmDialog
        aberto={aberto}
        titulo="Converter recibo em Nota Fiscal?"
        descricao="O recibo será substituído por uma Nota Fiscal com novo número. Esta ação não pode ser desfeita."
        labelConfirmar="Emitir NF"
        onConfirmar={confirmar}
        onCancelar={() => setAberto(false)}
      />
    </>
  );
}
