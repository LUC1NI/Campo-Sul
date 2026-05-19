"use client";

import { useState, useTransition } from "react";
import { criarCategoria, renomearCategoria, excluirCategoria } from "@/app/actions/produtos";
import { Pencil, Trash2, Check, X, Plus, Tag } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface CategoriaItem {
  id: string;
  nome: string;
  _count: { produtos: number };
}

interface CategoriasClientProps {
  categorias: CategoriaItem[];
}

export function CategoriasClient({ categorias: inicial }: CategoriasClientProps) {
  const [lista, setLista] = useState(inicial);
  const [novaCategoria, setNovaCategoria] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editandoNome, setEditandoNome] = useState("");
  const [confirmar, setConfirmar] = useState<{ id: string; nome: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    const nome = novaCategoria.trim();
    if (!nome) return;
    startTransition(async () => {
      const r = await criarCategoria(nome);
      if (!r.ok) {
        toast.error(r.erro);
        return;
      }
      const cat = r.data;
      setLista((prev) =>
        [...prev, { ...cat, _count: { produtos: 0 } }].sort((a, b) => a.nome.localeCompare(b.nome))
      );
      setNovaCategoria("");
      toast.success(`Categoria "${nome}" criada`);
    });
  }

  function startEdit(cat: CategoriaItem) {
    setEditandoId(cat.id);
    setEditandoNome(cat.nome);
  }

  function handleRename(id: string) {
    const nome = editandoNome.trim();
    if (!nome) return;
    startTransition(async () => {
      const r = await renomearCategoria(id, nome);
      if (!r.ok) {
        toast.error(r.erro);
        return;
      }
      setLista((prev) =>
        prev
          .map((c) => (c.id === id ? { ...c, nome } : c))
          .sort((a, b) => a.nome.localeCompare(b.nome))
      );
      setEditandoId(null);
      toast.success("Categoria renomeada");
    });
  }

  function confirmarExclusao(id: string, nome: string) {
    setConfirmar({ id, nome });
  }

  function handleDelete() {
    if (!confirmar) return;
    const { id, nome } = confirmar;
    setConfirmar(null);
    startTransition(async () => {
      const r = await excluirCategoria(id);
      if (!r.ok) {
        toast.error(r.erro);
        return;
      }
      setLista((prev) => prev.filter((c) => c.id !== id));
      toast.success(`Categoria "${nome}" excluída`);
    });
  }

  return (
    <>
      <ConfirmDialog
        aberto={confirmar !== null}
        titulo="Excluir categoria"
        descricao={`Tem certeza que deseja excluir "${confirmar?.nome}"? Esta ação não pode ser desfeita.`}
        labelConfirmar="Excluir"
        variante="destrutivo"
        onConfirmar={handleDelete}
        onCancelar={() => setConfirmar(null)}
      />

      <div className="space-y-5">
        <div>
          <h1 className="font-fraunces text-2xl font-bold text-verde-mata">Categorias</h1>
          <p className="text-sm text-muted-foreground">Organize os produtos por categoria</p>
        </div>

        {/* Adicionar */}
        <div className="rounded-xl border border-border bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Nova categoria</h2>
          <div className="flex gap-2">
            <input
              value={novaCategoria}
              onChange={(e) => setNovaCategoria(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="Ex.: Rações, Medicamentos, Ferramentas..."
              disabled={isPending}
              className="flex-1 rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm transition-all focus:border-verde-mata focus:outline-none focus:ring-2 focus:ring-verde-mata/30"
            />
            <button
              onClick={handleAdd}
              disabled={isPending || !novaCategoria.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-verde-mata px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-verde-claro disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Adicionar
            </button>
          </div>
        </div>

        {/* Lista */}
        <div className="overflow-hidden rounded-xl border border-border bg-white">
          {lista.length === 0 ? (
            <div className="py-14 text-center text-muted-foreground">
              <Tag className="mx-auto mb-2 h-8 w-8 opacity-30" />
              <p className="text-sm">Nenhuma categoria cadastrada</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {lista.map((cat) => (
                <li key={cat.id} className="flex items-center gap-3 px-5 py-3.5">
                  {editandoId === cat.id ? (
                    <>
                      <input
                        value={editandoNome}
                        onChange={(e) => setEditandoNome(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRename(cat.id);
                          if (e.key === "Escape") setEditandoId(null);
                        }}
                        autoFocus
                        className="flex-1 rounded-lg border border-verde-mata px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-verde-mata/30"
                      />
                      <button
                        onClick={() => handleRename(cat.id)}
                        disabled={isPending}
                        className="rounded-lg p-1.5 text-verde-mata transition-colors hover:bg-verde-mata/10"
                        title="Salvar"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setEditandoId(null)}
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted"
                        title="Cancelar"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm font-medium text-foreground">{cat.nome}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {cat._count.produtos} produto{cat._count.produtos !== 1 ? "s" : ""}
                      </span>
                      <button
                        onClick={() => startEdit(cat)}
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-verde-mata/10 hover:text-verde-mata"
                        title="Renomear"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => confirmarExclusao(cat.id, cat.nome)}
                        disabled={cat._count.produtos > 0 || isPending}
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-30"
                        title={
                          cat._count.produtos > 0
                            ? "Remova os produtos antes de excluir"
                            : "Excluir"
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
