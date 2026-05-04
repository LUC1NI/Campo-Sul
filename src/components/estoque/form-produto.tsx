"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Unidade, Categoria } from "@prisma/client";
import { Loader2, AlertCircle } from "lucide-react";

const UNIDADES = [
  { value: "UN", label: "Unidade (UN)" },
  { value: "KG", label: "Quilograma (KG)" },
  { value: "L", label: "Litro (L)" },
  { value: "SACO", label: "Saco" },
  { value: "CX", label: "Caixa (CX)" },
  { value: "M", label: "Metro (M)" },
];

const REGEX_CODIGO = /^[A-Za-z0-9._-]+$/;
const REGEX_GTIN = /^\d{8,14}$/;

const numeroValido = (v: string | null | undefined) => {
  if (v == null || v === "") return false;
  const n = Number(String(v).replace(",", "."));
  return !isNaN(n);
};

const schema = z.object({
  codigo: z.string()
    .min(1, "Código é obrigatório")
    .max(40, "Máx. 40 caracteres")
    .regex(REGEX_CODIGO, "Apenas letras, números, hífen, ponto ou underline"),
  gtin: z.string().optional().nullable()
    .refine((v) => !v || REGEX_GTIN.test(v.trim()), "GTIN deve ter 8 a 14 dígitos numéricos"),
  nome: z.string().min(2, "Nome precisa ter pelo menos 2 caracteres").max(200, "Nome muito longo"),
  descricao: z.string().max(1000, "Descrição muito longa").optional().nullable(),
  categoriaId: z.string().optional().nullable(),
  unidade: z.nativeEnum(Unidade),
  precoCusto: z.string().refine((v) => numeroValido(v) && Number(v.replace(",", ".")) >= 0, "Use somente números (ex.: 12.50 ou 12,50)"),
  precoVenda: z.string().refine((v) => numeroValido(v) && Number(v.replace(",", ".")) > 0, "Preço de venda precisa ser maior que zero"),
  podeFracionar: z.boolean(),
  pesoUnidade: z.string().optional().nullable(),
  unidadeFracao: z.nativeEnum(Unidade).optional().nullable(),
  quantidade: z.string().refine((v) => !v || (numeroValido(v) && Number(v.replace(",", ".")) >= 0), "Use somente números"),
  quantidadeMinima: z.string().refine((v) => !v || (numeroValido(v) && Number(v.replace(",", ".")) >= 0), "Use somente números"),
}).superRefine((data, ctx) => {
  if (data.podeFracionar) {
    if (!data.pesoUnidade) {
      ctx.addIssue({ code: "custom", path: ["pesoUnidade"], message: "Obrigatório para fracionado" });
    }
    if (!data.unidadeFracao) {
      ctx.addIssue({ code: "custom", path: ["unidadeFracao"], message: "Obrigatório para fracionado" });
    }
  }
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

        {/* Identificação — 2 colunas no desktop */}
        <section className="lg:col-span-2 bg-white rounded-xl border border-border p-5 space-y-4">
          <h2 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
            Identificação
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Código interno"
              required
              hint="Letras, números, hífen ou ponto. Ex.: MILHO-001"
              error={errors.codigo?.message}
            >
              <input
                {...register("codigo")}
                className={inputCls(!!errors.codigo)}
                placeholder="MILHO-001"
                autoComplete="off"
                spellCheck={false}
              />
            </Field>
            <Field
              label="GTIN / EAN"
              optional
              hint="Código de barras (8 a 14 dígitos). Deixe vazio se não tiver."
              error={errors.gtin?.message}
            >
              <input
                {...register("gtin")}
                className={inputCls(!!errors.gtin)}
                placeholder="7891234567890"
                inputMode="numeric"
                autoComplete="off"
              />
            </Field>
          </div>

          <Field
            label="Nome do produto"
            required
            hint="Como aparece no PDV e nas notas."
            error={errors.nome?.message}
          >
            <input
              {...register("nome")}
              className={inputCls(!!errors.nome)}
              placeholder="Ração Premium Adulto 25 kg"
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Categoria"
              optional
              hint="Agrupa produtos para busca e relatórios."
              error={errors.categoriaId?.message}
            >
              <select {...register("categoriaId")} className={inputCls(!!errors.categoriaId)}>
                <option value="">Sem categoria</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </Field>
            <Field
              label="Unidade de estoque"
              required
              hint="Como o produto é controlado (UN, KG, L…)."
              error={errors.unidade?.message}
            >
              <select {...register("unidade")} className={inputCls(!!errors.unidade)}>
                {UNIDADES.map((u) => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field
            label="Descrição"
            optional
            hint="Detalhes complementares: marca, validade, indicação."
            error={errors.descricao?.message}
          >
            <textarea
              {...register("descricao")}
              className={inputCls(!!errors.descricao)}
              rows={3}
              placeholder="Detalhes adicionais..."
            />
          </Field>
        </section>

        {/* Preços + Estoque + Fracionamento empilhados */}
        <div className="space-y-5">

          <section className="bg-white rounded-xl border border-border p-5 space-y-4">
            <h2 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
              Preços
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Custo (R$)"
                required
                hint="Quanto pagou."
                error={errors.precoCusto?.message}
              >
                <input
                  {...register("precoCusto")}
                  className={inputCls(!!errors.precoCusto)}
                  placeholder="0,00"
                  inputMode="decimal"
                  autoComplete="off"
                />
              </Field>
              <Field
                label="Venda (R$)"
                required
                hint="Preço cobrado."
                error={errors.precoVenda?.message}
              >
                <input
                  {...register("precoVenda")}
                  className={inputCls(!!errors.precoVenda)}
                  placeholder="0,00"
                  inputMode="decimal"
                  autoComplete="off"
                />
              </Field>
            </div>
          </section>

          <section className="bg-white rounded-xl border border-border p-5 space-y-4">
            <h2 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
              Estoque
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {!isEdit ? (
                <Field
                  label="Inicial"
                  optional
                  hint="Quantas tem hoje."
                  error={errors.quantidade?.message}
                >
                  <input
                    {...register("quantidade")}
                    className={inputCls(!!errors.quantidade)}
                    placeholder="0"
                    inputMode="decimal"
                    autoComplete="off"
                  />
                </Field>
              ) : (
                <div className="text-xs text-muted-foreground self-center">
                  Para alterar a quantidade, use a seção <strong>Ajuste de Estoque</strong> abaixo.
                </div>
              )}
              <Field
                label="Mínima (alerta)"
                optional
                hint="Aviso de reposição."
                error={errors.quantidadeMinima?.message}
              >
                <input
                  {...register("quantidadeMinima")}
                  className={inputCls(!!errors.quantidadeMinima)}
                  placeholder="0"
                  inputMode="decimal"
                  autoComplete="off"
                />
              </Field>
            </div>
          </section>

          <section className="bg-white rounded-xl border border-border p-5 space-y-3">
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
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                  Marque se o produto também pode ser vendido por peso/volume
                  (ex.: saco de 25 kg vendido por kg).
                </p>
              </div>
            </div>

            {podeFracionar && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <Field
                  label="Peso da unidade"
                  required
                  hint="Ex.: 25 (saco de 25 kg)."
                  error={errors.pesoUnidade?.message}
                >
                  <input
                    {...register("pesoUnidade")}
                    className={inputCls(!!errors.pesoUnidade)}
                    placeholder="25"
                    inputMode="decimal"
                    autoComplete="off"
                  />
                </Field>
                <Field
                  label="Unidade fracionada"
                  required
                  hint="Ex.: KG."
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

      {/* Seção extra (ajuste de estoque na edição) */}
      {extraSection}

      {/* Ações */}
      <div className="flex flex-wrap gap-3 pt-1">
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
  const base = "w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 transition-all";
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
      <label className="flex items-center gap-1.5 text-xs font-medium text-foreground/75 mb-1">
        <span>{label}</span>
        {required && <span className="text-red-600 font-bold leading-none">*</span>}
        {optional && <span className="text-muted-foreground/60 text-[9px] uppercase tracking-wide">opcional</span>}
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
