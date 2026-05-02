"use client";

import { useState } from "react";
import { TipoDocumento } from "@prisma/client";
import { X, FileText, Receipt, Loader2 } from "lucide-react";

interface DialogFinalizacaoProps {
  aberto: boolean;
  onFechar: () => void;
  onConfirmar: (tipoDocumento?: TipoDocumento, cpfCnpj?: string, nomeCliente?: string) => void;
  finalizando: boolean;
}

export function DialogFinalizacao({ aberto, onFechar, onConfirmar, finalizando }: DialogFinalizacaoProps) {
  const [tipo, setTipo] = useState<TipoDocumento | "SEM">( "SEM");
  const [cpf, setCpf] = useState("");
  const [nome, setNome] = useState("");

  if (!aberto) return null;

  function handleConfirmar() {
    if (tipo === "SEM") {
      onConfirmar(undefined, undefined, undefined);
    } else if (tipo === "RECIBO") {
      onConfirmar("RECIBO", undefined, undefined);
    } else {
      onConfirmar("NOTA", cpf.replace(/\D/g, "") || undefined, nome || undefined);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" onClick={onFechar} />

      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 z-10">
        <button
          onClick={onFechar}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="font-fraunces text-xl font-bold text-verde-mata mb-2">Finalizar venda</h2>
        <p className="text-sm text-muted-foreground mb-6">Escolha o tipo de documento</p>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <TipoBtn
            ativo={tipo === "SEM"}
            onClick={() => setTipo("SEM")}
            icon={<Receipt className="w-5 h-5" />}
            titulo="Sem documento"
            descricao="Não emite"
          />
          <TipoBtn
            ativo={tipo === "RECIBO"}
            onClick={() => setTipo("RECIBO")}
            icon={<Receipt className="w-5 h-5" />}
            titulo="Recibo"
            descricao="Sem CPF"
          />
          <TipoBtn
            ativo={tipo === "NOTA"}
            onClick={() => setTipo("NOTA")}
            icon={<FileText className="w-5 h-5" />}
            titulo="Nota Fiscal"
            descricao="Com CPF"
          />
        </div>

        {tipo === "NOTA" && (
          <div className="space-y-3 mb-6">
            <div>
              <label className="block text-xs font-medium text-foreground/70 mb-1.5">
                CPF / CNPJ (opcional)
              </label>
              <input
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                placeholder="000.000.000-00"
                className="w-full px-3.5 py-2.5 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-verde-mata/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground/70 mb-1.5">
                Nome do cliente (opcional)
              </label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Consumidor não identificado"
                className="w-full px-3.5 py-2.5 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-verde-mata/30"
              />
            </div>
          </div>
        )}

        <button
          onClick={handleConfirmar}
          disabled={finalizando}
          className="w-full flex items-center justify-center gap-2 bg-verde-mata hover:bg-verde-claro disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          {finalizando && <Loader2 className="w-4 h-4 animate-spin" />}
          {finalizando ? "Processando..." : "Confirmar venda"}
        </button>
      </div>
    </div>
  );
}

function TipoBtn({
  ativo,
  onClick,
  icon,
  titulo,
  descricao,
}: {
  ativo: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  titulo: string;
  descricao: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-center ${
        ativo
          ? "border-verde-mata bg-verde-mata/5 text-verde-mata"
          : "border-border text-muted-foreground hover:border-verde-claro/50"
      }`}
    >
      {icon}
      <span className="text-xs font-semibold">{titulo}</span>
      <span className="text-xs opacity-70">{descricao}</span>
    </button>
  );
}
