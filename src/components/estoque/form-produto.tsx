"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Unidade, Categoria } from "@prisma/client";
import { Loader2, Info, AlertCircle } from "lucide-react";

const UNIDADES = [
  { value: "UN", label: "Unidade (UN)" },
  { value: "KG", label: "Quilograma (KG)" },
  { value: "L", label: "Litro (L)" },
  { value: "SACO", label: "Saco" },
  { value: "CX", label: "Caixa (CX)" },
  { value: "M", label: "Metro (M)" },
];

const numeroValido = (v: string | null | undefined) => {
  if (!v) return false;
  const n = Number(String(v).replace(",", "."));
  return !isNaN(n);
};

const schema = z.object({
  codigo: z.string().min(1, "Código é obrigatório"),
  gtin: z.string().optional().nullable(),
  nome: z.string().min(2, "Nome precisa ter pelo menos 2 caracteres"),
  descricao: z.string().optional().nullable(),
  categoriaId: z.string().optional().nullable(),
  unidade: z.nativeEnum(Unidade),
  precoCusto: z.string().refine((v) => numeroValido(v) && Number(v.replace(",", ".")) >= 0, "Use somente números (ex.: 12.50 ou 12,50)"),
  precoVenda: z.string().refine((v) => numeroValido(v) && Number(v.replace(",", ".")) > 0, "Preço de venda precisa ser maior que zero"),
  podeFracionar: z.boolean(),
  pesoUnidade: z.string().optional().nullable(),
  unidadeFracao: z.nativeEnum(Unidade).optional().nullable(),
  quantidade: z.string().refine((v) => !v || (numeroValido(v) && Number(v.replace(",", ".")) >= 0), "Use somente números"),
  quantidadeMinima: z.string().refine((v) => !v || (numeroValido(v) && Number(v.replace(",", ".")) >= 0), "Use somente números"),
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
      {/* Aviso geral */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3 text-sm">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-blue-900">
          <p className="font-semibold">Antes de cadastrar:</p>
          <ul className="mt-1 space-y-0.5 text-xs text-blue-800/90 list-disc list-inside">
            <li>Campos com <span className="text-red-600">*</span> são obrigatórios.</li>
            <li>Use ponto ou vírgula para decimais (ex.: 12.50 ou 12,50).</li>
            <li>O <strong>código interno</strong> precisa ser único — não use o mesmo de outro produto.</li>
            <li>Marque <strong>Venda fracionada</strong> só se o produto puder ser vendido por peso/volume (ex.: saco de milho vendido em kg).</li>
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">

        {/* Coluna esquerda — Identificação */}
        <section className="bg-white rounded-xl border border-border p-6 space-y-4">
          <h2 className="font-semibold text-foreground text-sm uppercase tracking-wide text-muted-foreground">
            Identificação
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Código interno"
              required
              hint="Identificador único do produto (ex.: MILHO-001, RAC-002)."
              error={errors.codigo?.message}
            >
              <input
                {...register("codigo")}
                className={inputCls(!!errors.codigo)}
                placeholder="RAC-001"
              />
            </Field>
            <Field
              label="GTIN / EAN (código de barras)"
              optional
              hint="Opcional. Deixe em branco se o produto não tem código de barras."
              error={errors.gtin?.message}
            >
              <input
                {...register("gtin")}
                className={inputCls(!!errors.gtin)}
                placeholder="7891234567890"
              />
            </Field>
          </div>

          <Field
            label="Nome do produto"
            required
            hint="Como o produto aparecerá no PDV e nas notas."
            error={errors.nome?.message}
          >
            <input
              {...register("nome")}
              className={inputCls(!!errors.nome)}
              placeholder="Ração Premium Adulto 25kg"
            />
          </Field>

          <Field
            label="Descrição"
            optional
            hint="Detalhes complementares (marca, validade, indicação)."
            error={errors.descricao?.message}
          >
            <textarea
              {...register("descricao")}
              className={inputCls(!!errors.descricao)}
              rows={4}
              placeholder="Detalhes adicionais..."
            />
          </Field>

          <Field
            label="Categoria"
            optional
            hint="Agrupa produtos para facilitar busca e relatórios."
            error={errors.categoriaId?.message}
          >
            <select {...register("categoriaId")} className={inputCls(!!errors.categoriaId)}>
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

            <Field
              label="Unidade de estoque"
              required
              hint="Como o produto é controlado no estoque (UN para inteiro, KG para granel, etc.)."
              error={errors.unidade?.message}
            >
              <select {...register("unidade")} className={inputCls(!!errors.unidade)}>
                {UNIDADES.map((u) => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Preço de custo (R$)"
                required
                hint="Quanto você pagou pela unidade."
                error={errors.precoCusto?.message}
              >
                <input
                  {...register("precoCusto")}
                  className={inputCls(!!errors.precoCusto)}
                  placeholder="0,00"
                  inputMode="decimal"
                />
              </Field>
              <Field
                label="Preço de venda (R$)"
                required
                hint="Quanto será cobrado no PDV."
                error={errors.precoVenda?.message}
              >
                <input
                  {...register("precoVenda")}
                  className={inputCls(!!errors.precoVenda)}
                  placeholder="0,00"
                  inputMode="decimal"
                />
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
                <Field
                  label="Quantidade inicial"
                  optional
                  hint="Quantas unidades já estão no estoque hoje. Use 0 se ainda não tem."
                  error={errors.quantidade?.message}
                >
                  <input
                    {...register("quantidade")}
                    className={inputCls(!!errors.quantidade)}
                    placeholder="0"
                    inputMode="decimal"
                  />
                </Field>
              )}
              <Field
                label="Qtd. mínima (alerta)"
                optional
                hint="Quando o estoque ficar abaixo desse número, o sistema avisa para repor."
                error={errors.quantidadeMinima?.message}
              >
                <input
                  {...register("quantidadeMinima")}
                  className={inputCls(!!errors.quantidadeMinima)}
                  placeholder="0"
                  inputMode="decimal"
                />
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
                  Marque se o produto pode ser vendido por peso/volume (ex.: saco de 25 kg vendido também por quilo).
                </p>
              </div>
            </div>

            {podeFracionar && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <Field
                  label="Peso / volume da unidade"
                  required
                  hint="Ex.: 25 (se a unidade fechada é um saco de 25 kg)."
                  error={errors.pesoUnidade?.message}
                >
                  <input
                    {...register("pesoUnidade")}
                    className={inputCls(!!errors.pesoUnidade)}
                    placeholder="25"
                    inputMode="decimal"
                  />
                </Field>
                <Field
                  label="Unidade fracionada"
                  required
                  hint="Em qual unidade o produto será vendido fracionado."
                  error={errors.unidadeFracao?.message}
                >
                  <select {...register("unidadeFracao")} className={inputCls(!!errors.unidadeFracao)}>
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
        <Link
          href="/estoque"
          className="flex items-center gap-2 border border-border text-foreground font-medium px-6 py-2.5 rounded-lg hover:bg-muted transition-colors"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}

function inputCls(hasError: boolean) {
  const base = "w-full px-3.5 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 transition-all";
  if (hasError) {
    return `${base} border-red-500 focus:ring-red-200 focus:border-red-500 bg-red-50/30`;
  }
  return `${base} border-border focus:ring-verde-mata/30 focus:border-verde-mata`;
}

function Field({
  label,
  required,
  optional,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-medium text-foreground/70 mb-1.5">
        <span>{label}</span>
        {required && <span className="text-red-600 font-bold">*</span>}
        {optional && <span className="text-muted-foreground/70 text-[10px] uppercase tracking-wide">(opcional)</span>}
      </label>
      {children}
      {hint && !error && (
        <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{hint}</p>
      )}
      {error && (
        <p className="flex items-center gap-1 text-xs text-red-600 mt-1 font-medium">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
