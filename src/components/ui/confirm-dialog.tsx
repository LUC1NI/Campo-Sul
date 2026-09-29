"use client";

import { useEffect } from "react";

interface ConfirmDialogProps {
  aberto: boolean;
  titulo: string;
  descricao?: string;
  labelConfirmar?: string;
  variante?: "default" | "destrutivo";
  onConfirmar: () => void;
  onCancelar: () => void;
}

export function ConfirmDialog({
  aberto,
  titulo,
  descricao,
  labelConfirmar = "Confirmar",
  variante = "default",
  onConfirmar,
  onCancelar,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancelar();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto, onCancelar]);

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onCancelar} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-titulo"
        aria-describedby={descricao ? "confirm-descricao" : undefined}
        className="relative bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4 animate-in fade-in zoom-in-95 duration-150">
        <h3 id="confirm-titulo" className="font-fraunces text-lg font-bold text-foreground">{titulo}</h3>
        {descricao && (
          <p id="confirm-descricao" className="text-sm text-muted-foreground mt-1.5">{descricao}</p>
        )}
        <div className="flex justify-end gap-3 mt-6">
          <button
            autoFocus
            onClick={onCancelar}
            className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
              variante === "destrutivo"
                ? "bg-destructive hover:bg-destructive/90"
                : "bg-verde-mata hover:bg-verde-claro"
            }`}
          >
            {labelConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
