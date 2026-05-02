"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Unidade, Categoria } from "@prisma/client";
import { Loader2 } from "lucide-react";

const UNIDADES = [
  { value: "UN", label: "Unidade (UN)" },
  { value: "KG", label: "Quilograma (KG)" },
  { value: "L", label: "Litro (L)" },
  { value: "SACO", label: "Saco" },
  { value: "CX", label: "Caixa (CX)" },
  { value: "M", label: "Metro (M)" },
];

const schema = z.object({
  codigo: z.string().min(1, "Obrigatório"),
  gtin: z.string().optional().nullable(),
  nome: z.string().min(2, "Mínimo 2 caracteres"),
  descricao: z.string().optional().nullable(),
  categoriaId: z.string().optional().nullable(),
  unidade: z.nativeEnum(Unidade),
  precoCusto: z.string().min(1, "Obrigatório"),
  precoVenda: z.string().min(1, "Obrigatório"),
  podeFracionar: z.boolean(),
  pesoUnidade: z.string().optional().nullable(),
  unidadeFracao: z.nativeEnum(Unidade).optional().nullable(),
  quantidade: z.string(),
  quantidadeMinima: z.string(),
});

export type ProdutoFormData = z.infer<typeof schema>;

interface FormProdutoProps {
  defaultValues?: Partial<ProdutoFormData>;
  categorias: Categoria[];
  onSubmit: (data: ProdutoFormData) => Promise<void>;
  isEdit?: boolean;
  extraSection?: React.ReactNode;
}

export function FormProduto({ defaultValues, categorias, onSubmit, isEdit, extraSection }: FormProdutoProps) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProdutoFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      quantidade: "0",
      quantidadeMinima: "0",
      podeFracionar: false,
      unidade: "UN",
      ...defaultValues,
    },
  });

  const podeFracionar = watch("podeFracionar");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">

        {/* Coluna esquerda — Identificação */}
        <section className="bg-white rounded-xl border border-border p-6 space-y-4">
          <h2 className="font-semibold text-foreground text-sm uppercase tracking-wide text-muted-foreground">
            Identificação
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Código interno *" error={errors.codigo?.message}>
              <input {...register("codigo")} className={inputCls} placeholder="RAC-001" />
            </Field>
            <Field label="GTIN / EAN (código de barras)" error={errors.gtin?.message}>
              <input {...register("gtin")} className={inputCls} placeholder="7891234567890" />
            </Field>
          </div>

          <Field label="Nome do produto *" error={errors.nome?.message}>
            <input {...register("nome")} className={inputCls} placeholder="Ração Premium Adulto 25kg" />
          </Field>

          <Field label="Descrição" error={errors.descricao?.message}>
            <textarea
              {...register("descricao")}
              className={inputCls}
              rows={4}
              placeholder="Detalhes adicionais..."
            />
          </Field>

          <Field label="Categoria" error={errors.categoriaId?.message}>
            <select {...register("categoriaId")} className={inputCls}>
              <option value="">Sem categoria</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </Field>
        </section>

        {/* Coluna direita — Preços, Estoque, Fracionamento */}
        <div className="space-y-5">

          {/* Preços e Unidade */}
          <section className="bg-white rounded-xl border border-border p-6 space-y-4">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
              Preços e Unidade
            </h2>

            <Field label="Unidade de estoque *" error={errors.unidade?.message}>
              <select {...register("unidade")} className={inputCls}>
                {UNIDADES.map((u) => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Preço de custo (R$) *" error={errors.precoCusto?.message}>
                <input {...register("precoCusto")} className={inputCls} placeholder="0,00" />
              </Field>
              <Field label="Preço de venda (R$) *" error={errors.precoVenda?.message}>
                <input {...register("precoVenda")} className={inputCls} placeholder="0,00" />
              </Field>
            </div>
          </section>

          {/* Estoque */}
          <section className="bg-white rounded-xl border border-border p-6 space-y-4">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
              Estoque
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {!isEdit && (
                <Field label="Quantidade inicial" error={errors.quantidade?.message}>
                  <input {...register("quantidade")} className={inputCls} placeholder="0" />
                </Field>
              )}
              <Field label="Qtd. mínima (alerta)" error={errors.quantidadeMinima?.message}>
                <input {...register("quantidadeMinima")} className={inputCls} placeholder="0" />
              </Field>
            </div>
          </section>

          {/* Fracionamento */}
          <section className="bg-white rounded-xl border border-border p-6 space-y-4">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="podeFracionar"
                {...register("podeFracionar")}
                className="mt-0.5 w-4 h-4 accent-verde-mata flex-shrink-0"
              />
              <div>
                <label
                  htmlFor="podeFracionar"
                  className="font-semibold text-foreground text-sm cursor-pointer"
                >
                  Venda fracionada
                </label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Ex.: saco de 25 kg vendido também por quilo
                </p>
              </div>
            </div>

            {podeFracionar && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <Field label="Peso / volume da unidade *" error={errors.pesoUnidade?.message}>
                  <input
                    {...register("pesoUnidade")}
                    className={inputCls}
                    placeholder="25 (para saco de 25 kg)"
                  />
                </Field>
                <Field label="Unidade fracionada *" error={errors.unidadeFracao?.message}>
                  <select {...register("unidadeFracao")} className={inputCls}>
                    <option value="">Selecione...</option>
                    {UNIDADES.map((u) => (
                      <option key={u.value} value={u.value}>{u.label}</option>
                    ))}
                  </select>
                </Field>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Seção extra (ex: ajuste de estoque na edição) */}
      {extraSection}

      {/* Ações */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 bg-verde-mata hover:bg-verde-claro text-white font-medium px-6 py-2.5 rounded-lg transition-colors disabled:opacity-60"
        >
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {isEdit ? "Salvar alterações" : "Cadastrar produto"}
        </button>
        <a
          href="/estoque"
          className="flex items-center gap-2 border border-border text-foreground font-medium px-6 py-2.5 rounded-lg hover:bg-muted transition-colors"
        >
          Cancelar
        </a>
      </div>
    </form>
  );
}

const inputCls =
  "w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-verde-mata/30 focus:border-verde-mata transition-all";

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-foreground/70 mb-1.5">{label}</label>
      {children}
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}
