"use client";

import { useState } from "react";
import { AlertTriangle, FileText, Loader2, RefreshCw } from "lucide-react";
import { marcarErroPdf, marcarPdfOk } from "@/app/actions/vendas";
import { toast } from "sonner";
import { StatusDocumento, TipoDocumento } from "@prisma/client";

interface PdfLinkProps {
  documentoId: string;
  tipo: TipoDocumento;
  numero: number;
  statusDoc: StatusDocumento;
  erroInfo: string | null;
}

export function PdfLink({ documentoId, tipo, numero, statusDoc, erroInfo }: PdfLinkProps) {
  const [carregando, setCarregando] = useState(false);
  const [status, setStatus] = useState(statusDoc);

  const tipoPath = tipo === "NOTA" ? "nota" : "recibo";
  const nomeArquivo = `${tipoPath}-${String(numero).padStart(6, "0")}.pdf`;

  async function abrirPdf() {
    setCarregando(true);
    try {
      const res = await fetch(`/api/pdf/${tipoPath}/${documentoId}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
        setTimeout(() => URL.revokeObjectURL(url), 60_000);

        if (status === "ERRO_PDF") {
          await marcarPdfOk(documentoId);
          setStatus("EMITIDO");
          toast.success("PDF gerado com sucesso!");
        }
      } else {
        const motivo = `HTTP ${res.status}`;
        if (status !== "ERRO_PDF") {
          await marcarErroPdf(documentoId, motivo);
          setStatus("ERRO_PDF");
        }
        toast.error(`Falha ao gerar PDF (${motivo}). Tente novamente.`);
      }
    } catch {
      if (status !== "ERRO_PDF") {
        await marcarErroPdf(documentoId, "Erro de rede");
        setStatus("ERRO_PDF");
      }
      toast.error("Erro de conexão ao tentar gerar o PDF.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      {status === "ERRO_PDF" && (
        <span
          title={erroInfo ?? "Erro ao gerar PDF — clique em Reemitir para tentar novamente"}
          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 cursor-help"
        >
          <AlertTriangle className="w-3 h-3 shrink-0" />
          PDF com erro
        </span>
      )}
      <button
        onClick={abrirPdf}
        disabled={carregando}
        title={nomeArquivo}
        className="inline-flex items-center gap-1 text-xs text-verde-mata hover:underline font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {carregando ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : status === "ERRO_PDF" ? (
          <RefreshCw className="w-3 h-3" />
        ) : (
          <FileText className="w-3 h-3" />
        )}
        {carregando ? "Gerando..." : status === "ERRO_PDF" ? "Reemitir PDF" : "Abrir PDF"}
      </button>
    </div>
  );
}
