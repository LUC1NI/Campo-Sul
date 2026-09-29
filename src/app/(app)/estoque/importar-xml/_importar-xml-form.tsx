"use client";

import { useState, useRef, useMemo, useCallback, DragEvent } from "react";
import {
  parsearXml,
  confirmarImportacaoXml,
  type XmlPreview,
  type ItemPreview,
  type MetodoVinculo,
} from "@/app/actions/xml";
import { quantidadeParaEstoque } from "@/lib/nfe-correspondencia";
import { formatBRL, formatCNPJ } from "@/lib/format";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  Loader2,
  Truck,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { DialogCorrespondencia, type ProdutoEscolhido } from "./_dialog-correspondencia";

interface Categoria {
  id: string;
  nome: string;
}

function sugerirCategoria(descricao: string, categorias: Categoria[]): string {
  if (categorias.length === 0) return "";
  const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const desc = normalizar(descricao);
  for (const cat of categorias) {
    const palavras = normalizar(cat.nome).split(/\s+/);
    if (palavras.some((p) => p.length >= 3 && desc.includes(p))) return cat.id;
  }
  return "";
}

type Origem = MetodoVinculo | "sugestao" | "manual";

/** O que o usuário decidiu para cada item da nota. */
type Decisao =
  | { tipo: "existente"; produto: ProdutoEscolhido; origem: Origem; qtdEstoque: string }
  | { tipo: "novo"; precoVenda: string; categoriaId: string }
  | { tipo: "pendente" };

const ROTULO_ORIGEM: Record<Origem, string> = {
  gtin: "Código de barras",
  fornecedor: "Código do fornecedor",
  nome: "Mesmo nome",
  sugestao: "Confirmado por você",
  manual: "Escolhido por você",
};

const valido = (v: string) => /^\d+([.,]\d+)?$/.test(v.trim()) && Number(v.replace(",", ".")) > 0;
const paraDecimal = (v: string) => v.trim().replace(",", ".");

function decisaoExistente(item: ItemPreview, produto: ProdutoEscolhido, origem: Origem): Decisao {
  const historico = item.fatorHistorico?.produtoId === produto.id ? item.fatorHistorico.fator : null;
  const qtd = quantidadeParaEstoque(item.quantidade, item.unidadeMapeada, produto, historico);
  return { tipo: "existente", produto, origem, qtdEstoque: qtd ?? "" };
}

interface ImportarXmlFormProps {
  categorias: Categoria[];
}

export function ImportarXmlForm({ categorias }: ImportarXmlFormProps) {
  const [step, setStep] = useState<"upload" | "preview" | "sucesso">("upload");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<XmlPreview | null>(null);
  const [xmlContent, setXmlContent] = useState("");
  const [decisoes, setDecisoes] = useState<Decisao[]>([]);
  const [dialogo, setDialogo] = useState<{ idx: number; modo: "revisar" | "buscar" } | null>(null);
  const [drag, setDrag] = useState(false);
  const [resultado, setResultado] = useState({ novos: 0, atualizados: 0, custosAtualizados: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

  const novoPara = useCallback(
    (item: ItemPreview): Decisao => ({ tipo: "novo", precoVenda: "", categoriaId: sugerirCategoria(item.descricao, categorias) }),
    [categorias]
  );

  const pendentes = useMemo(
    () => decisoes.flatMap((d, i) => (d.tipo === "pendente" ? [i] : [])),
    [decisoes]
  );

  async function processarArquivo(file: File) {
    if (!file.name.toLowerCase().endsWith(".xml")) {
      toast.error("Selecione um arquivo XML (.xml)");
      return;
    }
    const content = await file.text();
    setLoading(true);
    try {
      const result = await parsearXml(content);
      if (!result.ok) {
        toast.error(result.erro);
        return;
      }
      const iniciais = result.data.itens.map<Decisao>((item) =>
        item.vinculo
          ? decisaoExistente(item, item.vinculo.produto, item.vinculo.metodo)
          : item.sugestoes.length
            ? { tipo: "pendente" }
            : novoPara(item)
      );
      setXmlContent(content);
      setPreview(result.data);
      setDecisoes(iniciais);
      setStep("preview");
      // Popup abre sozinho se há itens que precisam de confirmação
      const primeiro = iniciais.findIndex((d) => d.tipo === "pendente");
      if (primeiro >= 0 && !result.data.jaImportada) setDialogo({ idx: primeiro, modo: "revisar" });
    } catch {
      toast.error("Erro ao processar arquivo");
    } finally {
      setLoading(false);
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files[0];
    if (file) processarArquivo(file);
  }

  function decidir(idx: number, d: Decisao) {
    const proximas = decisoes.map((x, i) => (i === idx ? d : x));
    setDecisoes(proximas);
    // No modo revisão, segue para o próximo item pendente
    const prox = proximas.findIndex((x, i) => x.tipo === "pendente" && i !== idx);
    setDialogo(dialogo?.modo === "revisar" && prox >= 0 ? { idx: prox, modo: "revisar" } : null);
  }

  function atualizar(idx: number, parcial: Partial<{ qtdEstoque: string; precoVenda: string; categoriaId: string }>) {
    setDecisoes((ds) => ds.map((d, i) => (i === idx && d.tipo !== "pendente" ? ({ ...d, ...parcial } as Decisao) : d)));
  }

  async function handleConfirmar() {
    if (!preview) return;
    if (pendentes.length) {
      setDialogo({ idx: pendentes[0], modo: "revisar" });
      return;
    }
    for (let i = 0; i < decisoes.length; i++) {
      const d = decisoes[i];
      const nome = preview.itens[i].descricao;
      if (d.tipo === "existente" && !valido(d.qtdEstoque)) {
        toast.error(`Informe quanto entra no estoque: ${nome}`);
        document.getElementById(`qtd-${i}`)?.focus();
        return;
      }
      if (d.tipo === "novo" && !valido(d.precoVenda)) {
        toast.error(`Informe o preço de venda: ${nome}`);
        document.getElementById(`preco-${i}`)?.focus();
        return;
      }
    }

    setLoading(true);
    const result = await confirmarImportacaoXml({
      xmlOriginal: xmlContent,
      itens: decisoes.map((d) =>
        d.tipo === "existente"
          ? { produtoId: d.produto.id, qtdEstoque: paraDecimal(d.qtdEstoque) }
          : d.tipo === "novo"
            ? { produtoId: null, precoVenda: paraDecimal(d.precoVenda), categoriaId: d.categoriaId || null }
            : { produtoId: null }
      ),
    });
    setLoading(false);

    if (!result.ok) {
      toast.error(result.erro);
      return;
    }
    toast.dismiss(); // limpa avisos de validação antigos
    setResultado({ novos: result.novos, atualizados: result.atualizados, custosAtualizados: result.custosAtualizados });
    setStep("sucesso");
  }

  function resetar() {
    setStep("upload");
    setPreview(null);
    setXmlContent("");
    setDecisoes([]);
    setDialogo(null);
  }

  const contagem = {
    reconhecidos: decisoes.filter((d) => d.tipo === "existente").length,
    novos: decisoes.filter((d) => d.tipo === "novo").length,
  };
  const inputCls =
    "rounded-lg border px-2 py-1 text-right text-sm tabular-nums focus:border-verde-mata focus:outline-none focus:ring-1 focus:ring-verde-mata";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <Link
          href="/estoque"
          aria-label="Voltar ao estoque"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="font-fraunces text-2xl font-bold text-verde-mata">Importar XML NF-e</h1>
          <p className="text-sm text-muted-foreground">
            Importe uma nota fiscal para atualizar o estoque e o custo automaticamente
          </p>
        </div>
      </div>

      {/* Step: upload */}
      {step === "upload" && (
        <div className="mx-auto max-w-xl py-8">
          <input
            ref={inputRef}
            id="xml-file-input"
            type="file"
            accept=".xml"
            className="hidden"
            disabled={loading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) processarArquivo(file);
              e.target.value = "";
            }}
          />
          <div
            className={`rounded-2xl border-2 border-dashed transition-colors ${
              loading ? "cursor-default" : "cursor-pointer"
            } ${
              drag
                ? "border-verde-mata bg-verde-mata/5"
                : "border-border hover:border-verde-mata/50 hover:bg-muted/20"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={handleDrop}
            onClick={() => !loading && inputRef.current?.click()}
          >
            <div className="flex flex-col items-center justify-center gap-4 px-8 py-16 text-center">
              {loading ? (
                <>
                  <Loader2 className="h-10 w-10 animate-spin text-verde-mata" />
                  <p className="text-sm text-muted-foreground">Lendo a nota e procurando os produtos...</p>
                </>
              ) : (
                <>
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-verde-mata/10">
                    <Upload className="h-8 w-8 text-verde-mata" />
                  </div>
                  <div>
                    <p className="mb-1 text-base font-semibold text-foreground">Arraste o arquivo XML aqui</p>
                    <p className="text-sm text-muted-foreground">ou clique para selecionar</p>
                  </div>
                  <label
                    htmlFor="xml-file-input"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-verde-mata px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-verde-claro"
                  >
                    <FileText className="h-4 w-4" />
                    Selecionar arquivo .xml
                  </label>
                  <p className="text-xs text-muted-foreground/60">Formato NF-e 4.00 (SEFAZ)</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step: preview */}
      {step === "preview" && preview && (
        <div className="space-y-5">
          <div className="rounded-xl border border-border bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-verde-mata/10">
                  <Truck className="h-5 w-5 text-verde-mata" />
                </div>
                <div>
                  <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Nota Fiscal Eletrônica
                  </p>
                  <p className="font-fraunces text-xl font-bold text-verde-mata">NF-e nº {preview.numeroNf}</p>
                  <p className="mt-0.5 text-sm font-medium text-foreground">{preview.nomeEmitente}</p>
                  <p className="text-xs text-muted-foreground">CNPJ: {formatCNPJ(preview.cnpjEmitente)}</p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="mb-1 text-xs text-muted-foreground">Valor total</p>
                <p className="text-2xl font-bold text-verde-mata">{formatBRL(Number(preview.valorTotal))}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {preview.itens.length} {preview.itens.length === 1 ? "item" : "itens"}
                </p>
              </div>
            </div>
          </div>

          {preview.jaImportada && (
            <div className="flex items-center gap-2.5 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Esta NF-e já foi importada anteriormente e não pode ser importada novamente.
            </div>
          )}

          {/* Resumo */}
          <div className="flex flex-wrap gap-2.5 text-xs">
            {contagem.reconhecidos > 0 && (
              <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-green-700">
                {contagem.reconhecidos} já cadastrado(s) — estoque e custo serão atualizados
              </span>
            )}
            {pendentes.length > 0 && (
              <button
                onClick={() => setDialogo({ idx: pendentes[0], modo: "revisar" })}
                className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 font-medium text-amber-800 hover:bg-amber-100"
              >
                {pendentes.length} para revisar — parecem produtos que você já tem →
              </button>
            )}
            {contagem.novos > 0 && (
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-blue-700">
                {contagem.novos} produto(s) novo(s) serão cadastrados
              </span>
            )}
          </div>

          {/* Itens */}
          <div className="overflow-x-auto rounded-xl border border-border bg-white">
            <table className="w-full text-sm" style={{ minWidth: "900px" }}>
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Item da nota</th>
                  <th className="w-28 px-4 py-3 text-right font-medium">Qtd / custo</th>
                  <th className="px-4 py-3 font-medium">Produto no sistema</th>
                  <th className="w-64 px-4 py-3 font-medium">Entrada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {preview.itens.map((item, i) => {
                  const d = decisoes[i];
                  return (
                    <tr key={i} className={d?.tipo === "pendente" ? "bg-amber-50/50" : undefined}>
                      <td className="px-4 py-3 align-top">
                        <p className="font-medium leading-tight text-foreground">{item.descricao}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {item.codigoFornecedor && <>cód. {item.codigoFornecedor}</>}
                          {item.gtin && <> · EAN {item.gtin}</>}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right align-top tabular-nums">
                        <p>
                          {Number(item.quantidade).toLocaleString("pt-BR", { maximumFractionDigits: 4 })}{" "}
                          <span className="text-xs text-muted-foreground">{item.unidadeMapeada}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">{formatBRL(Number(item.valorUnitario))}</p>
                      </td>

                      <td className="px-4 py-3 align-top">
                        {d?.tipo === "existente" && (
                          <>
                            <span className="inline-flex items-center gap-1 rounded bg-green-50 px-1.5 py-0.5 text-xs text-green-700">
                              <CheckCircle className="h-3 w-3" /> {ROTULO_ORIGEM[d.origem]}
                            </span>
                            <p className="mt-1 font-medium leading-tight">{d.produto.nome}</p>
                            <button
                              onClick={() => setDialogo({ idx: i, modo: item.sugestoes.length ? "revisar" : "buscar" })}
                              className="mt-0.5 text-xs text-verde-mata underline-offset-2 hover:underline"
                            >
                              Trocar
                            </button>
                            <span className="text-xs text-muted-foreground"> · </span>
                            <button
                              onClick={() => decidir(i, novoPara(item))}
                              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                            >
                              Cadastrar como novo
                            </button>
                          </>
                        )}
                        {d?.tipo === "pendente" && (
                          <>
                            <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                              <AlertTriangle className="h-3 w-3" /> Parece com produto existente
                            </span>
                            <p className="mt-1 text-xs text-muted-foreground">{item.sugestoes[0]?.nome}</p>
                            <button
                              onClick={() => setDialogo({ idx: i, modo: "revisar" })}
                              className="mt-1 rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-600"
                            >
                              Revisar
                            </button>
                          </>
                        )}
                        {d?.tipo === "novo" && (
                          <>
                            <span className="inline-block rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">
                              Novo produto
                            </span>
                            <p className="mt-1">
                              <button
                                onClick={() => setDialogo({ idx: i, modo: item.sugestoes.length ? "revisar" : "buscar" })}
                                className="text-xs text-verde-mata underline-offset-2 hover:underline"
                              >
                                Já tenho este produto — vincular
                              </button>
                            </p>
                          </>
                        )}
                      </td>

                      <td className="px-4 py-3 align-top">
                        {d?.tipo === "existente" && (() => {
                          const mudouUnidade = d.produto.unidade !== item.unidadeMapeada;
                          const qtdOk = valido(d.qtdEstoque);
                          const custoNovo = qtdOk ? Number(item.valorTotal) / Number(paraDecimal(d.qtdEstoque)) : null;
                          return (
                            <>
                              <label htmlFor={`qtd-${i}`} className="text-xs text-muted-foreground">
                                Entra no estoque
                              </label>
                              <div className="mt-0.5 flex items-center gap-1.5">
                                <input
                                  id={`qtd-${i}`}
                                  inputMode="decimal"
                                  value={d.qtdEstoque}
                                  onChange={(e) => atualizar(i, { qtdEstoque: e.target.value })}
                                  aria-invalid={!qtdOk}
                                  className={`w-24 ${inputCls} ${qtdOk ? "border-border" : "border-red-400 bg-red-50"}`}
                                />
                                <span className="text-xs font-medium">{d.produto.unidade}</span>
                              </div>
                              {mudouUnidade && (
                                <p className={`mt-1 text-xs ${qtdOk ? "text-muted-foreground" : "text-red-600"}`}>
                                  {qtdOk
                                    ? `Nota em ${item.unidadeMapeada}, produto em ${d.produto.unidade} — confira.`
                                    : `Nota em ${item.unidadeMapeada}: quantos ${d.produto.unidade} entram?`}
                                </p>
                              )}
                              {custoNovo !== null && (
                                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                                  Custo:
                                  {d.produto.precoCusto && (
                                    <>
                                      <span>{formatBRL(Number(d.produto.precoCusto))}</span>
                                      <ArrowRight className="h-3 w-3" />
                                    </>
                                  )}
                                  <span className="font-medium text-foreground">{formatBRL(custoNovo)}</span>
                                </p>
                              )}
                            </>
                          );
                        })()}
                        {d?.tipo === "novo" && (
                          <div className="space-y-1.5">
                            <div>
                              <label htmlFor={`preco-${i}`} className="text-xs text-muted-foreground">
                                Preço de venda (custo {formatBRL(Number(item.valorUnitario))})
                              </label>
                              <input
                                id={`preco-${i}`}
                                inputMode="decimal"
                                placeholder="0,00"
                                value={d.precoVenda}
                                onChange={(e) => atualizar(i, { precoVenda: e.target.value })}
                                className={`mt-0.5 block w-28 ${inputCls} border-border`}
                              />
                            </div>
                            <select
                              aria-label="Categoria"
                              value={d.categoriaId}
                              onChange={(e) => atualizar(i, { categoriaId: e.target.value })}
                              className="w-40 rounded-lg border border-border bg-white px-2 py-1 text-sm focus:border-verde-mata focus:outline-none focus:ring-1 focus:ring-verde-mata"
                            >
                              <option value="">Sem categoria</option>
                              {categorias.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.nome}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                        {d?.tipo === "pendente" && <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <button onClick={resetar} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              ← Selecionar outro arquivo
            </button>
            <div className="flex items-center gap-3">
              {pendentes.length > 0 && (
                <p className="text-xs text-amber-700">Revise {pendentes.length} item(ns) antes de confirmar</p>
              )}
              <button
                onClick={handleConfirmar}
                disabled={loading || preview.jaImportada}
                className="inline-flex items-center gap-2 rounded-xl bg-verde-mata px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-verde-claro disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {pendentes.length ? "Revisar pendentes" : "Confirmar importação"}
              </button>
            </div>
          </div>
        </div>
      )}

      {dialogo && preview && (
        <DialogCorrespondencia
          item={preview.itens[dialogo.idx]}
          modoInicial={dialogo.modo}
          posicao={
            dialogo.modo === "revisar" && pendentes.includes(dialogo.idx)
              ? { atual: pendentes.indexOf(dialogo.idx) + 1, total: pendentes.length }
              : undefined
          }
          onEscolher={(produto, origem) =>
            decidir(dialogo.idx, decisaoExistente(preview.itens[dialogo.idx], produto, origem))
          }
          onNovo={() => decidir(dialogo.idx, novoPara(preview.itens[dialogo.idx]))}
          onFechar={() => setDialogo(null)}
        />
      )}

      {/* Step: sucesso */}
      {step === "sucesso" && (
        <div className="mx-auto max-w-sm py-8">
          <div className="rounded-2xl border border-border bg-white p-10 text-center shadow-sm">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-green-100">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="mb-2 font-fraunces text-xl font-bold text-foreground">Importação concluída!</h2>
            <p className="mb-1 text-sm text-muted-foreground">Estoque atualizado com sucesso.</p>
            <div className="mb-7 space-y-0.5 text-sm">
              {resultado.novos > 0 && (
                <p className="font-medium text-blue-700">{resultado.novos} produto(s) criado(s)</p>
              )}
              {resultado.atualizados > 0 && (
                <p className="font-medium text-green-700">{resultado.atualizados} item(ns) somado(s) ao estoque</p>
              )}
              {resultado.custosAtualizados > 0 && (
                <p className="text-muted-foreground">{resultado.custosAtualizados} custo(s) atualizado(s) pela nota</p>
              )}
            </div>
            <div className="flex flex-col gap-2.5">
              <button
                onClick={resetar}
                className="rounded-xl border border-border px-4 py-2.5 text-sm transition-colors hover:bg-muted"
              >
                Importar outra NF-e
              </button>
              <Link
                href="/notas?tab=recebidas"
                className="rounded-xl bg-verde-mata px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-verde-claro"
              >
                Ver NF-e recebidas
              </Link>
              <Link href="/estoque" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                Ver estoque
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
