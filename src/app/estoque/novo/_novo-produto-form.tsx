"use client";

import { useRouter } from "next/navigation";
import { FormProduto, ProdutoFormData } from "@/components/estoque/form-produto";
import { criarProduto } from "@/app/actions/produtos";
import { Categoria } from "@prisma/client";
import { toast } from "sonner";

interface NovoProdutoFormProps {
  categorias: Categoria[];
}

export function NovoProdutoForm({ categorias }: NovoProdutoFormProps) {
  const router = useRouter();

  async function handleSubmit(data: ProdutoFormData) {
    try {
      await criarProduto(data);
      router.push("/estoque");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao cadastrar produto");
    }
  }

  return <FormProduto categorias={categorias} onSubmit={handleSubmit} />;
}
