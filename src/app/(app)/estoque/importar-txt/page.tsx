"use client";

import { useState, useRef, DragEvent } from "react";
import { parsearEstoqueTxt, confirmarImportacaoTxt, TxtPreview } from "@/app/actions/estoque";
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

      // Por padrÃ£o: seleciona apenas os novos produtos
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
    preview.itens.forEach((_, i) => {
      sel[i] = valor;
    });
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
        toast.error(`Informe o preÃ§o de venda para o produto: ${preview.itens[i].gtin}`);
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
    <div className="max-w-5xl space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href="/estoque"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
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
        <div className="flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="mb-0.5 font-medium">Sobre este importador</p>
            <p>
              O arquivo Ã© analisado e agrupado por cÃ³digo GTIN/EAN. Produtos duplicados sÃ£o
              mesclados somando as quantidades. Produtos importados terÃ£o o cÃ³digo GTIN como nome
              temporÃ¡rio â€” edite-os depois em{" "}
              <Link href="/estoque" className="underline">
                Estoque
              </Link>
              .
            </p>
          </div>
        </div>
      )}

      {/* Upload */}
      {step === "upload" && (
        <div
          className={`cursor-pointer rounded-xl border-2 border-dashed p-14 text-center transition-colors ${
            drag
              ? "border-verde-mata bg-verde-mata/5"
              : "border-border hover:border-verde-mata/50 hover:bg-muted/30"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={handleDrop}
          onClick={() => !loading && inputRef.current?.click()}
        >
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-verde-mata" />
              <p className="text-sm text-muted-foreground">Processando arquivo...</p>
            </div>
          ) : (
            <>
              <Upload className="mx-auto mb-4 h-10 w-10 text-muted-foreground/40" />
              <p className="mb-1 text-base font-medium text-foreground">
                Arraste o arquivo TXT aqui
              </p>
              <p className="mb-5 text-sm text-muted-foreground">ou clique para selecionar</p>
              <span className="inline-flex items-center gap-2 rounded-lg bg-verde-mata px-4 py-2 text-sm text-white transition-colors hover:bg-verde-claro">
                <FileText className="h-4 w-4" />
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
          <div className="rounded-xl border border-border bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Arquivo analisado
                </p>
                <p className="text-sm text-foreground">
                  <span className="font-bold text-verde-mata">{preview.totalLinhas}</span> linhas
                  â†’ <span className="font-bold text-verde-mata">{preview.totalUnicos}</span>{" "}
                  produtos Ãºnicos
                </p>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {preview.itens.filter((i) => !i.produtoExistente).length > 0 && (
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-blue-700">
                    {preview.itens.filter((i) => !i.produtoExistente).length} novos produtos
                  </span>
                )}
                {preview.itens.filter((i) => i.produtoExistente).length > 0 && (
                  <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs text-green-700">
                    {preview.itens.filter((i) => i.produtoExistente).length} jÃ¡ cadastrados
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Aviso nomes */}
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Produtos novos serÃ£o criados com o GTIN como nome temporÃ¡rio. Acesse{" "}
              <Link href="/estoque" className="font-medium underline">
                Estoque
              </Link>{" "}
              apÃ³s a importaÃ§Ã£o para renomear cada produto.
            </p>
          </div>

          {/* SeleÃ§Ã£o em massa */}
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">{totalSelecionados} selecionados</span>
            <button
              type="button"
              onClick={() => toggleTodos(true)}
              className="text-verde-mata hover:underline"
            >
              Selecionar todos
            </button>
            <button
              type="button"
              onClick={() => toggleTodos(false)}
              className="text-muted-foreground hover:underline"
            >
              Desmarcar todos
            </button>
          </div>

          {/* Tabela */}
          <div className="overflow-hidden rounded-xl border border-border bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={totalSelecionados === preview.itens.length}
                      onChange={(e) => toggleTodos(e.target.checked)}
                      className="accent-verde-mata"
                    />
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">GTIN</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Qtd.</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Custo</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    PreÃ§o Venda
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                    SituaÃ§Ã£o
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {preview.itens.map((item, i) => (
                  <tr
                    key={i}
                    className={`transition-colors hover:bg-muted/20 ${!selecionados[i] ? "opacity-50" : ""}`}
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
                        <p className="mt-0.5 text-xs text-green-600">â†’ {item.produtoNome}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {item.quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
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
                          className="w-28 rounded border border-border px-2 py-1 text-right text-sm focus:border-verde-mata focus:outline-none focus:ring-1 focus:ring-verde-mata"
                          placeholder="0.00"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.produtoExistente ? (
                        <span className="inline-block rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">
                          Atualiza estoque
                        </span>
                      ) : (
                        <span className="inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
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
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              â† Selecionar outro arquivo
            </button>
            <button
              onClick={handleConfirmar}
              disabled={loading || totalSelecionados === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-verde-mata px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-verde-claro disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Importar {totalSelecionados} produto{totalSelecionados !== 1 ? "s" : ""}
            </button>
          </div>
        </div>
      )}

      {/* Sucesso */}
      {step === "sucesso" && (
        <div className="rounded-xl border border-border bg-white p-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-7 w-7 text-green-600" />
          </div>
          <h2 className="mb-2 font-fraunces text-xl font-bold text-foreground">
            ImportaÃ§Ã£o concluÃ­da!
          </h2>
          <p className="mb-7 text-sm text-muted-foreground">
            {resultado.criados > 0 && (
              <span className="font-medium text-blue-700">
                {resultado.criados} produto(s) criado(s)
              </span>
            )}
            {resultado.criados > 0 && resultado.atualizados > 0 && " Â· "}
            {resultado.atualizados > 0 && (
              <span className="font-medium text-green-700">
                {resultado.atualizados} produto(s) com estoque atualizado
              </span>
            )}
          </p>
          <p className="mb-7 text-xs text-muted-foreground">
            Lembre-se de editar os nomes dos produtos novos em Estoque.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={resetar}
              className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-muted"
            >
              Importar outro arquivo
            </button>
            <Link
              href="/estoque"
              className="rounded-lg bg-verde-mata px-4 py-2 text-sm text-white transition-colors hover:bg-verde-claro"
            >
              Ver estoque
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
