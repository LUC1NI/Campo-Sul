"use client";

import { useRouter } from "next/navigation";
import { FormProduto, ProdutoFormData } from "@/components/estoque/form-produto";
import { atualizarProduto } from "@/app/actions/produtos";
import { Categoria, Unidade } from "@prisma/client";
import { toast } from "sonner";

export interface ProdutoSerializado {
  id: string;
  codigo: string;
  gtin: string | null;
  nome: string;
  descricao: string | null;
  categoriaId: string | null;
  unidade: Unidade;
  precoCusto: string;
  precoVenda: string;
  podeFracionar: boolean;
  pesoUnidade: string | null;
  unidadeFracao: Unidade | null;
  quantidadeMinima: string;
}

interface EditarProdutoFormProps {
  produto: ProdutoSerializado;
  categorias: Categoria[];
  extraSection?: React.ReactNode;
}

export function EditarProdutoForm({ produto, categorias, extraSection }: EditarProdutoFormProps) {
  const router = useRouter();
  const defaultValues: Partial<ProdutoFormData> = {
    codigo: produto.codigo,
    gtin: produto.gtin,
    nome: produto.nome,
    descricao: produto.descricao,
    categoriaId: produto.categoriaId,
    unidade: produto.unidade,
    precoCusto: produto.precoCusto,
    precoVenda: produto.precoVenda,
    podeFracionar: produto.podeFracionar,
    pesoUnidade: produto.pesoUnidade,
    unidadeFracao: produto.unidadeFracao,
    quantidadeMinima: produto.quantidadeMinima,
  };

  async function handleSubmit(data: ProdutoFormData) {
    try {
      await atualizarProduto(produto.id, data);
      router.push("/estoque");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar produto");
    }
  }

  return (
    <FormProduto
      categorias={categorias}
      onSubmit={handleSubmit}
      defaultValues={defaultValues}
      isEdit
      extraSection={extraSection}
    />
  );
}
