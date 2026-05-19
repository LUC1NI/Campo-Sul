"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { criarUsuario, atualizarUsuario } from "@/app/actions/usuarios";
import { formatData } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Pencil, X, Loader2, ShieldCheck, User } from "lucide-react";

type UsuarioRow = {
  id: string;
  nome: string;
  email: string;
  role: string;
  ativo: boolean;
  createdAt: Date;
};

const baseSchema = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  email: z.string().email("E-mail inválido"),
  role: z.enum(["ADMIN", "FUNCIONARIO"]),
});

const criarSchema = baseSchema.extend({
  senha: z.string().min(6, "Mínimo 6 caracteres"),
});

const editarSchema = baseSchema.extend({
  ativo: z.boolean(),
  novaSenha: z.string().optional(),
});

type CriarForm = z.infer<typeof criarSchema>;
type EditarForm = z.infer<typeof editarSchema>;

interface Props {
  usuarios: UsuarioRow[];
  currentUserId: string;
}

export function UsuariosCliente({ usuarios, currentUserId }: Props) {
  const router = useRouter();
  const [modal, setModal] = useState<"criar" | "editar" | null>(null);
  const [editando, setEditando] = useState<UsuarioRow | null>(null);

  const formCriar = useForm<CriarForm>({
    resolver: zodResolver(criarSchema),
    defaultValues: { nome: "", email: "", senha: "", role: "FUNCIONARIO" },
  });

  const formEditar = useForm<EditarForm>({
    resolver: zodResolver(editarSchema),
  });

  function abrirCriar() {
    formCriar.reset({ nome: "", email: "", senha: "", role: "FUNCIONARIO" });
    setModal("criar");
  }

  function abrirEditar(u: UsuarioRow) {
    setEditando(u);
    formEditar.reset({
      nome: u.nome,
      email: u.email,
      role: u.role as "ADMIN" | "FUNCIONARIO",
      ativo: u.ativo,
      novaSenha: "",
    });
    setModal("editar");
  }

  function fechar() {
    setModal(null);
    setEditando(null);
  }

  async function handleCriar(data: CriarForm) {
    const r = await criarUsuario(data);
    if (!r.ok) {
      toast.error(r.erro);
      return;
    }
    toast.success("Usuário criado com sucesso");
    fechar();
    router.refresh();
  }

  async function handleEditar(data: EditarForm) {
    if (!editando) return;
    const r = await atualizarUsuario(editando.id, {
      ...data,
      novaSenha: data.novaSenha || undefined,
    });
    if (!r.ok) {
      toast.error(r.erro);
      return;
    }
    toast.success("Usuário atualizado");
    fechar();
    router.refresh();
  }

  const ativos = usuarios.filter((u) => u.ativo);
  const inativos = usuarios.filter((u) => !u.ativo);

  return (
    <>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-fraunces text-2xl font-bold text-verde-mata">Usuários</h1>
            <p className="text-sm text-muted-foreground">
              {ativos.length} ativo(s) · {inativos.length} inativo(s)
            </p>
          </div>
          <button
            onClick={abrirCriar}
            className="inline-flex items-center gap-1.5 rounded-lg bg-verde-mata px-3 py-2 text-sm text-white transition-colors hover:bg-verde-claro"
          >
            <Plus className="h-4 w-4" />
            Novo usuário
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Usuário</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Função</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Cadastrado em
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {usuarios.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    Nenhum usuário cadastrado
                  </td>
                </tr>
              ) : (
                usuarios.map((u) => (
                  <tr
                    key={u.id}
                    className={`transition-colors hover:bg-muted/30 ${!u.ativo ? "opacity-50" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-verde-mata/10">
                          {u.role === "ADMIN" ? (
                            <ShieldCheck className="h-4 w-4 text-verde-mata" />
                          ) : (
                            <User className="h-4 w-4 text-verde-mata" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium leading-tight text-foreground">
                            {u.nome}
                            {u.id === currentUserId && (
                              <span className="ml-1.5 text-xs text-muted-foreground">(você)</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          u.role === "ADMIN"
                            ? "bg-verde-mata/10 text-verde-mata"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {u.role === "ADMIN" ? "Administrador" : "Funcionário"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatData(u.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          u.ativo ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                        }`}
                      >
                        {u.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => abrirEditar(u)}
                        className="inline-flex items-center gap-1 text-xs text-verde-mata hover:underline"
                      >
                        <Pencil className="h-3 w-3" />
                        Editar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={fechar} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <h2 className="font-fraunces text-lg font-bold text-verde-mata">
                  {modal === "criar" ? "Novo usuário" : "Editar usuário"}
                </h2>
                <button
                  onClick={fechar}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Form criar */}
              {modal === "criar" && (
                <form onSubmit={formCriar.handleSubmit(handleCriar)} className="space-y-4 p-6">
                  <Field label="Nome completo" error={formCriar.formState.errors.nome?.message}>
                    <input
                      {...formCriar.register("nome")}
                      className={inputCls}
                      placeholder="João da Silva"
                      autoFocus
                    />
                  </Field>

                  <Field label="E-mail" error={formCriar.formState.errors.email?.message}>
                    <input
                      {...formCriar.register("email")}
                      type="email"
                      className={inputCls}
                      placeholder="joao@exemplo.com"
                    />
                  </Field>

                  <Field label="Senha" error={formCriar.formState.errors.senha?.message}>
                    <input
                      {...formCriar.register("senha")}
                      type="password"
                      className={inputCls}
                      placeholder="Mínimo 6 caracteres"
                    />
                  </Field>

                  <Field label="Função" error={formCriar.formState.errors.role?.message}>
                    <select {...formCriar.register("role")} className={inputCls}>
                      <option value="FUNCIONARIO">Funcionário</option>
                      <option value="ADMIN">Administrador</option>
                    </select>
                  </Field>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={fechar}
                      className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-muted"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={formCriar.formState.isSubmitting}
                      className="inline-flex items-center gap-2 rounded-lg bg-verde-mata px-4 py-2 text-sm text-white transition-colors hover:bg-verde-claro disabled:opacity-50"
                    >
                      {formCriar.formState.isSubmitting && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      )}
                      Criar usuário
                    </button>
                  </div>
                </form>
              )}

              {/* Form editar */}
              {modal === "editar" && editando && (
                <form onSubmit={formEditar.handleSubmit(handleEditar)} className="space-y-4 p-6">
                  <Field label="Nome completo" error={formEditar.formState.errors.nome?.message}>
                    <input {...formEditar.register("nome")} className={inputCls} autoFocus />
                  </Field>

                  <Field label="E-mail" error={formEditar.formState.errors.email?.message}>
                    <input {...formEditar.register("email")} type="email" className={inputCls} />
                  </Field>

                  <Field label="Função" error={formEditar.formState.errors.role?.message}>
                    <select
                      {...formEditar.register("role")}
                      className={inputCls}
                      disabled={editando.id === currentUserId}
                    >
                      <option value="FUNCIONARIO">Funcionário</option>
                      <option value="ADMIN">Administrador</option>
                    </select>
                  </Field>

                  <Field
                    label="Nova senha"
                    hint="Deixe em branco para manter a senha atual"
                    error={formEditar.formState.errors.novaSenha?.message}
                  >
                    <input
                      {...formEditar.register("novaSenha")}
                      type="password"
                      className={inputCls}
                      placeholder="••••••••"
                    />
                  </Field>

                  {editando.id !== currentUserId && (
                    <div className="flex items-center gap-2">
                      <input
                        {...formEditar.register("ativo")}
                        type="checkbox"
                        id="ativo"
                        className="h-4 w-4 accent-verde-mata"
                      />
                      <label htmlFor="ativo" className="text-sm text-foreground">
                        Conta ativa
                      </label>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={fechar}
                      className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-muted"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={formEditar.formState.isSubmitting}
                      className="inline-flex items-center gap-2 rounded-lg bg-verde-mata px-4 py-2 text-sm text-white transition-colors hover:bg-verde-claro disabled:opacity-50"
                    >
                      {formEditar.formState.isSubmitting && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      )}
                      Salvar
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

const inputCls =
  "w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-verde-mata/30 focus:border-verde-mata transition-all";

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground/80">{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
