import { AppLayout } from "@/components/app/app-layout";
import { listarCategorias } from "@/app/actions/produtos";
import { NovoProdutoForm } from "./_novo-produto-form";

export default async function NovoProdutoPage() {
  const categorias = await listarCategorias();

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-5">
        <div>
          <h1 className="font-fraunces text-2xl font-bold text-verde-mata">Novo Produto</h1>
          <p className="text-sm text-muted-foreground">Cadastrar produto no estoque</p>
        </div>
        <NovoProdutoForm categorias={categorias} />
      </div>
    </AppLayout>
  );
}
