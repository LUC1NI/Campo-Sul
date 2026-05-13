"use client";

import { useState } from "react";
import { TipoDocumento } from "@prisma/client";
import { X, FileText, Receipt, Ban, Loader2, Check } from "lucide-react";

interface DialogFinalizacaoProps {
  aberto: boolean;
  onFechar: () => void;
  onConfirmar: (tipoDocumento?: TipoDocumento, cpfCnpj?: string, nomeCliente?: string) => void;
  finalizando: boolean;
}

export function DialogFinalizacao({ aberto, onFechar, onConfirmar, finalizando }: DialogFinalizacaoProps) {
  const [tipo, setTipo] = useState<TipoDocumento | "SEM">("SEM");
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

  const opcoes: { valor: TipoDocumento | "SEM"; icon: React.ReactNode; titulo: string; descricao: string }[] = [
    {
      valor: "SEM",
      icon: <Ban className="w-5 h-5 shrink-0" />,
      titulo: "Sem documento",
      descricao: "Registra a venda sem emitir comprovante",
    },
    {
      valor: "RECIBO",
      icon: <Receipt className="w-5 h-5 shrink-0" />,
      titulo: "Recibo",
      descricao: "Emite comprovante simples, sem identificar o comprador",
    },
    {
      valor: "NOTA",
      icon: <FileText className="w-5 h-5 shrink-0" />,
      titulo: "Nota Fiscal",
      descricao: "Emite nota fiscal — CPF/CNPJ opcional",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onFechar} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 z-10">
        <button
          onClick={onFechar}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="font-fraunces text-xl font-bold text-verde-mata mb-1">Finalizar venda</h2>
        <p className="text-sm text-muted-foreground mb-5">Selecione o tipo de documento</p>

        <div className="flex flex-col gap-2 mb-5">
          {opcoes.map((op) => (
            <button
              key={op.valor}
              onClick={() => setTipo(op.valor)}
              className={`flex items-center gap-4 px-4 py-3.5 rounded-xl border-2 text-left transition-all ${
                tipo === op.valor
                  ? "border-verde-mata bg-verde-mata/5 text-verde-mata"
                  : "border-border text-foreground hover:border-verde-claro/60 hover:bg-gray-50"
              }`}
            >
              <span className={tipo === op.valor ? "text-verde-mata" : "text-muted-foreground"}>
                {op.icon}
              </span>
              <span className="flex-1">
                <span className="block text-sm font-semibold leading-tight">{op.titulo}</span>
                <span className="block text-xs text-muted-foreground mt-0.5">{op.descricao}</span>
              </span>
              {tipo === op.valor && (
                <Check className="w-4 h-4 text-verde-mata shrink-0" />
              )}
            </button>
          ))}
        </div>

        {tipo === "NOTA" && (
          <div className="space-y-3 mb-5">
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
