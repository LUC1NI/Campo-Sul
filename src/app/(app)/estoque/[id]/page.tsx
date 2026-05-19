import { prisma } from "@/lib/prisma";
import { listarCategorias } from "@/app/actions/produtos";
import { EditarProdutoForm } from "./_editar-produto-form";
import { AjusteEstoque } from "./_ajuste-estoque";
import { notFound } from "next/navigation";

export default async function EditarProdutoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [produto, categorias] = await Promise.all([
    prisma.produto.findUnique({ where: { id, ativo: true } }),
    listarCategorias(),
  ]);

  if (!produto) notFound();

  // Serializa os campos Decimal para string — Client Components não aceitam Decimal do Prisma
  const produtoSerializado = {
    id: produto.id,
    codigo: produto.codigo,
    gtin: produto.gtin,
    nome: produto.nome,
    descricao: produto.descricao,
    categoriaId: produto.categoriaId,
    unidade: produto.unidade,
    precoCusto: String(produto.precoCusto),
    precoVenda: String(produto.precoVenda),
    podeFracionar: produto.podeFracionar,
    pesoUnidade: produto.pesoUnidade ? String(produto.pesoUnidade) : null,
    unidadeFracao: produto.unidadeFracao,
    quantidadeMinima: String(produto.quantidadeMinima),
  };

  return (
      <div className="max-w-6xl mx-auto space-y-5">
        <div>
          <h1 className="font-fraunces text-2xl font-bold text-verde-mata">Editar Produto</h1>
          <p className="text-sm text-muted-foreground">{produto.nome}</p>
        </div>

        <EditarProdutoForm
          produto={produtoSerializado}
          categorias={categorias}
          extraSection={
            <AjusteEstoque
              produtoId={produto.id}
              quantidadeAtual={Number(produto.quantidade)}
              unidade={produto.unidade}
              podeFracionar={produto.podeFracionar}
            />
          }
        />
      </div>
  );
}
