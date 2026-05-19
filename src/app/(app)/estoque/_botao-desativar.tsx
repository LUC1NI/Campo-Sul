"use client";

import { useState, useTransition } from "react";
import { desativarProduto } from "@/app/actions/produtos";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EyeOff } from "lucide-react";
import { toast } from "sonner";

interface BotaoDesativarProps {
  id: string;
  nome: string;
}

export function BotaoDesativar({ id, nome }: BotaoDesativarProps) {
  const [aberto, setAberto] = useState(false);
  const [isPending, startTransition] = useTransition();

  function confirmar() {
    setAberto(false);
    startTransition(async () => {
      try {
        const result = await desativarProduto(id);
        if (result.ok) {
          toast.success(`"${nome}" desativado`);
        } else {
          toast.error(result.error);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao desativar produto");
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        disabled={isPending}
        title="Desativar produto"
        aria-label="Desativar produto"
        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
      >
        <EyeOff className="h-4 w-4" aria-hidden />
      </button>

      <ConfirmDialog
        aberto={aberto}
        titulo={`Desativar "${nome}"?`}
        descricao="O produto será ocultado do estoque e do PDV. O histórico de vendas é preservado."
        labelConfirmar="Desativar"
        variante="destrutivo"
        onConfirmar={confirmar}
        onCancelar={() => setAberto(false)}
      />
    </>
  );
}
