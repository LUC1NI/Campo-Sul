"use client";

import { useState, useRef, DragEvent } from "react";
import {
  parsearEstoqueTxt,
  confirmarImportacaoTxt,
  TxtPreview,
} from "@/app/actions/estoque";
import { formatBRL } from "@/lib/format";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  Loader2,
  Info,
} from "lucide-react";
import Link from "next/link";

export default function ImportarTxtPage() {
  const [step, setStep] = useState<"upload" | "preview" | "sucesso">("upload");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<TxtPreview | null>(null);
  const [drag, setDrag] = useState(false);
  const [selecionados, setSelecionados] = useState<Record<number, boolean>>({});
  const [precosVenda, setPrecosVenda] = useState<Record<number, string>>({});
  const [resultado, setResultado] = useState({ criados: 0, atualizados: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

  async function processarArquivo(file: File) {
    if (!file.name.toLowerCase().endsWith(".txt") && !file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Selecione um arquivo .txt ou .csv");
      return;
    }
    const content = await file.text();
    setLoading(true);
    try {
      const result = await parsearEstoqueTxt(content);
      if (!result.ok) {
        toast.error(result.erro);
        return;
      }
      setPreview(result.data);

      // Por padrão: seleciona apenas os novos produtos
      const sel: Record<number, boolean> = {};
      const pv: Record<number, string> = {};
      result.data.itens.forEach((item, i) => {
        sel[i] = !item.produtoExistente;
        pv[i] = item.precoVenda.toFixed(2);
      });
      setSelecionados(sel);
      setPrecosVenda(pv);
      setStep("preview");
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

  function toggleTodos(valor: boolean) {
    if (!preview) return;
    const sel: Record<number, boolean> = {};
    preview.itens.forEach((_, i) => { sel[i] = valor; });
    setSelecionados(sel);
  }

  async function handleConfirmar() {
    if (!preview) return;

    const itensParaImportar = preview.itens.filter((_, i) => selecionados[i]);
    if (itensParaImportar.length === 0) {
      toast.error("Selecione ao menos 1 produto para importar");
      return;
    }

    for (let i = 0; i < preview.itens.length; i++) {
      if (!selecionados[i] || preview.itens[i].produtoExistente) continue;
      const pv = Number(precosVenda[i]);
      if (!precosVenda[i] || isNaN(pv) || pv <= 0) {
        toast.error(`Informe o preço de venda para o produto: ${preview.itens[i].gtin}`);
        return;
      }
    }

    setLoading(true);
    try {
      const res = await confirmarImportacaoTxt({
        itens: preview.itens.map((item, i) => ({
          gtin: item.gtin,
          quantidade: item.quantidade,
          preco: item.preco,
          precoVenda: Number(precosVenda[i]) || item.precoVenda,
          importar: !!selecionados[i],
        })),
      });
      if (!res.ok) {
        toast.error(res.erro);
      } else {
        setResultado({ criados: res.criados, atualizados: res.atualizados });
        setStep("sucesso");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao importar");
    } finally {
      setLoading(false);
    }
  }

  function resetar() {
    setStep("upload");
    setPreview(null);
    setSelecionados({});
    setPrecosVenda({});
  }

  const totalSelecionados = Object.values(selecionados).filter(Boolean).length;

  return (
      <div className="space-y-5 max-w-5xl">
        <div className="flex items-center gap-3">
          <Link
            href="/estoque"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="font-fraunces text-2xl font-bold text-verde-mata">
              Importar Estoque (SIEG TXT)
            </h1>
            <p className="text-sm text-muted-foreground">
              Importe o arquivo de estoque exportado pelo sistema SIEG
            </p>
          </div>
        </div>

        {/* Aviso informativo */}
        {step === "upload" && (
          <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-4 py-3 text-sm">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium mb-0.5">Sobre este importador</p>
              <p>
                O arquivo é analisado e agrupado por código GTIN/EAN. Produtos duplicados são mesclados somando as quantidades.
                Produtos importados terão o código GTIN como nome temporário — edite-os depois em{" "}
                <Link href="/estoque" className="underline">Estoque</Link>.
              </p>
            </div>
          </div>
        )}

        {/* Upload */}
        {step === "upload" && (
          <div
            className={`border-2 border-dashed rounded-xl p-14 text-center transition-colors cursor-pointer ${
              drag
                ? "border-verde-mata bg-verde-mata/5"
                : "border-border hover:border-verde-mata/50 hover:bg-muted/30"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={handleDrop}
            onClick={() => !loading && inputRef.current?.click()}
          >
            {loading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-verde-mata" />
                <p className="text-sm text-muted-foreground">Processando arquivo...</p>
              </div>
            ) : (
              <>
                <Upload className="w-10 h-10 mx-auto mb-4 text-muted-foreground/40" />
                <p className="text-base font-medium text-foreground mb-1">
                  Arraste o arquivo TXT aqui
                </p>
                <p className="text-sm text-muted-foreground mb-5">ou clique para selecionar</p>
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-verde-mata text-white rounded-lg text-sm hover:bg-verde-claro transition-colors">
                  <FileText className="w-4 h-4" />
                  Selecionar arquivo .txt
                </span>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".txt,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) processarArquivo(file);
                    e.target.value = "";
                  }}
                />
              </>
            )}
          </div>
        )}

        {/* Preview */}
        {step === "preview" && preview && (
          <div className="space-y-4">
            {/* Resumo */}
            <div className="bg-white rounded-xl border border-border p-5">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
                    Arquivo analisado
                  </p>
                  <p className="text-sm text-foreground">
                    <span className="font-bold text-verde-mata">{preview.totalLinhas}</span> linhas →{" "}
                    <span className="font-bold text-verde-mata">{preview.totalUnicos}</span> produtos únicos
                  </p>
                </div>
                <div className="flex gap-2.5 flex-wrap">
                  {preview.itens.filter((i) => !i.produtoExistente).length > 0 && (
                    <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full">
                      {preview.itens.filter((i) => !i.produtoExistente).length} novos produtos
                    </span>
                  )}
                  {preview.itens.filter((i) => i.produtoExistente).length > 0 && (
                    <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2.5 py-1 rounded-full">
                      {preview.itens.filter((i) => i.produtoExistente).length} já cadastrados
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Aviso nomes */}
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>
                Produtos novos serão criados com o GTIN como nome temporário. Acesse{" "}
                <Link href="/estoque" className="underline font-medium">Estoque</Link>{" "}
                após a importação para renomear cada produto.
              </p>
            </div>

            {/* Seleção em massa */}
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground">{totalSelecionados} selecionados</span>
              <button type="button" onClick={() => toggleTodos(true)} className="text-verde-mata hover:underline">
                Selecionar todos
              </button>
              <button type="button" onClick={() => toggleTodos(false)} className="text-muted-foreground hover:underline">
                Desmarcar todos
              </button>
            </div>

            {/* Tabela */}
            <div className="bg-white rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={totalSelecionados === preview.itens.length}
                        onChange={(e) => toggleTodos(e.target.checked)}
                        className="accent-verde-mata"
                      />
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">GTIN</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Qtd.</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Custo</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Preço Venda</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground text-center">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {preview.itens.map((item, i) => (
                    <tr
                      key={i}
                      className={`hover:bg-muted/20 transition-colors ${!selecionados[i] ? "opacity-50" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={!!selecionados[i]}
                          onChange={(e) =>
                            setSelecionados((prev) => ({ ...prev, [i]: e.target.checked }))
                          }
                          className="accent-verde-mata"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-mono font-medium">{item.gtin}</p>
                        {item.produtoExistente && (
                          <p className="text-xs text-green-600 mt-0.5">→ {item.produtoNome}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {item.quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                        {formatBRL(item.preco)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {item.produtoExistente ? (
                          <span className="text-xs text-muted-foreground">mantido</span>
                        ) : (
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={precosVenda[i] ?? ""}
                            onChange={(e) =>
                              setPrecosVenda((prev) => ({ ...prev, [i]: e.target.value }))
                            }
                            className="w-28 px-2 py-1 text-right rounded border border-border text-sm focus:outline-none focus:ring-1 focus:ring-verde-mata focus:border-verde-mata"
                            placeholder="0.00"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.produtoExistente ? (
                          <span className="inline-block text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                            Atualiza estoque
                          </span>
                        ) : (
                          <span className="inline-block text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                            Novo produto
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={resetar}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Selecionar outro arquivo
              </button>
              <button
                onClick={handleConfirmar}
                disabled={loading || totalSelecionados === 0}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-verde-mata text-white rounded-lg text-sm font-medium hover:bg-verde-claro transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Importar {totalSelecionados} produto{totalSelecionados !== 1 ? "s" : ""}
              </button>
            </div>
          </div>
        )}

        {/* Sucesso */}
        {step === "sucesso" && (
          <div className="bg-white rounded-xl border border-border p-10 text-center">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-7 h-7 text-green-600" />
            </div>
            <h2 className="font-fraunces text-xl font-bold text-foreground mb-2">
              Importação concluída!
            </h2>
            <p className="text-sm text-muted-foreground mb-7">
              {resultado.criados > 0 && (
                <span className="text-blue-700 font-medium">{resultado.criados} produto(s) criado(s)</span>
              )}
              {resultado.criados > 0 && resultado.atualizados > 0 && " · "}
              {resultado.atualizados > 0 && (
                <span className="text-green-700 font-medium">{resultado.atualizados} produto(s) com estoque atualizado</span>
              )}
            </p>
            <p className="text-xs text-muted-foreground mb-7">
              Lembre-se de editar os nomes dos produtos novos em Estoque.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={resetar}
                className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted transition-colors"
              >
                Importar outro arquivo
              </button>
              <Link
                href="/estoque"
                className="px-4 py-2 bg-verde-mata text-white rounded-lg text-sm hover:bg-verde-claro transition-colors"
              >
                Ver estoque
              </Link>
            </div>
          </div>
        )}
      </div>
  );
}
