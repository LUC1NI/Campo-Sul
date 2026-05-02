"use client";

import { FormProduto, ProdutoFormData } from "@/components/estoque/form-produto";
import { criarProduto } from "@/app/actions/produtos";
import { Categoria } from "@prisma/client";
import { toast } from "sonner";

interface NovoProdutoFormProps {
  categorias: Categoria[];
}

export function NovoProdutoForm({ categorias }: NovoProdutoFormProps) {
  async function handleSubmit(data: ProdutoFormData) {
    try {
      await criarProduto(data);
    } catch (err: unknown) {
      if (err && typeof err === "object" && "digest" in err &&
          typeof (err as { digest: string }).digest === "string" &&
          (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")) {
        throw err;
      }
      toast.error(err instanceof Error ? err.message : "Erro ao cadastrar produto");
    }
  }

  return <FormProduto categorias={categorias} onSubmit={handleSubmit} />;
}
