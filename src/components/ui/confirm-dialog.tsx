"use client";

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
  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onCancelar} />
      <div className="relative bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4 animate-in fade-in zoom-in-95 duration-150">
        <h3 className="font-fraunces text-lg font-bold text-foreground">{titulo}</h3>
        {descricao && (
          <p className="text-sm text-muted-foreground mt-1.5">{descricao}</p>
        )}
        <div className="flex justify-end gap-3 mt-6">
          <button
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
