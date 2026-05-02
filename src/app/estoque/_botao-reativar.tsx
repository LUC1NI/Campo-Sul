"use client";

import { useTransition } from "react";
import { reativarProduto } from "@/app/actions/produtos";
import { toast } from "sonner";

interface BotaoReativarProps {
  id: string;
  nome: string;
}

export function BotaoReativar({ id, nome }: BotaoReativarProps) {
  const [isPending, startTransition] = useTransition();

  function handleReativar() {
    startTransition(async () => {
      try {
        await reativarProduto(id);
        toast.success(`"${nome}" reativado`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao reativar produto");
      }
    });
  }

  return (
    <button
      onClick={handleReativar}
      disabled={isPending}
      className="text-xs text-verde-mata hover:underline disabled:opacity-50"
    >
      {isPending ? "Reativando..." : "Reativar"}
    </button>
  );
}
