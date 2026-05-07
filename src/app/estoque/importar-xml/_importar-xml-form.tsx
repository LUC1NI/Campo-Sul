"use client";

import { useState, useRef, DragEvent } from "react";
import {
  parsearXml,
  confirmarImportacaoXml,
  XmlPreview,
} from "@/app/actions/xml";
import { formatBRL, formatCNPJ } from "@/lib/format";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import Link from "next/link";

interface Categoria {
  id: string;
  nome: string;
}

function sugerirCategoria(descricao: string, categorias: Categoria[]): string {
  if (categorias.length === 0) return "";
  const normalizar = (s: string) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const desc = normalizar(descricao);
  for (const cat of categorias) {
    const palavras = normalizar(cat.nome).split(/\s+/);
    if (palavras.some((p) => p.length >= 3 && desc.includes(p))) return cat.id;
  }
  return "";
}

interface ImportarXmlFormProps {
  categorias: Categoria[];
}

export function ImportarXmlForm({ categorias }: ImportarXmlFormProps) {
  const [step, setStep] = useState<"upload" | "preview" | "sucesso">("upload");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<XmlPreview | null>(null);
  const [xmlContent, setXmlContent] = useState("");
  const [precosVenda, setPrecosVenda] = useState<Record<number, string>>({});
  const [categoriasId, setCategoriasId] = useState<Record<number, string>>({});
  const [drag, setDrag] = useState(false);
  const [resultado, setResultado] = useState({ novos: 0, atualizados: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

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
      setXmlContent(content);
      setPreview(result.data);
      const precos: Record<number, string> = {};
      const cats: Record<number, string> = {};
      result.data.itens.forEach((item, i) => {
        if (!item.produtoId) {
          precos[i] = item.valorUnitario;
          cats[i] = sugerirCategoria(item.descricao, categorias);
        }
      });
      setPrecosVenda(precos);
      setCategoriasId(cats);
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

  async function handleConfirmar() {
    if (!preview) return;

    for (let i = 0; i < preview.itens.length; i++) {
      const item = preview.itens[i];
      if (!item.produtoId) {
        const pv = precosVenda[i];
        if (!pv || isNaN(Number(pv)) || Number(pv) <= 0) {
          toast.error(`Informe o preço de venda para: ${item.descricao}`);
          return;
        }
      }
    }

    setLoading(true);
    const result = await confirmarImportacaoXml({
      chaveAcesso: preview.chaveAcesso,
      numeroNf: preview.numeroNf,
      cnpjEmitente: preview.cnpjEmitente,
      nomeEmitente: preview.nomeEmitente,
      valorTotal: preview.valorTotal,
      xmlOriginal: xmlContent,
      itens: preview.itens.map((item, i) => ({
        gtin: item.gtin,
        descricao: item.descricao,
        unidadeNfe: item.unidadeNfe,
        quantidade: item.quantidade,
        valorUnitario: item.valorUnitario,
        valorTotal: item.valorTotal,
        produtoId: item.produtoId,
        unidadeMapeada: item.unidadeMapeada,
        precoVenda: item.produtoId ? undefined : precosVenda[i],
        categoriaId: item.produtoId ? null : (categoriasId[i] || null),
      })),
    });
    setLoading(false);

    if (!result.ok) {
      toast.error(result.erro);
      return;
    }
    setResultado({ novos: result.novos, atualizados: result.atualizados });
    setStep("sucesso");
  }

  function resetar() {
    setStep("upload");
    setPreview(null);
    setXmlContent("");
    setPrecosVenda({});
    setCategoriasId({});
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link
          href="/estoque"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="font-fraunces text-2xl font-bold text-verde-mata">
            Importar XML NF-e
          </h1>
          <p className="text-sm text-muted-foreground">
            Importe uma nota fiscal para atualizar o estoque automaticamente
          </p>
        </div>
      </div>

      {step === "upload" && (
        <>
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
            className={`border-2 border-dashed rounded-xl p-14 text-center transition-colors ${
              loading ? "cursor-default" : "cursor-pointer"
            } ${
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
          >
            {loading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-verde-mata" />
                <p className="text-sm text-muted-foreground">
                  Processando XML...
                </p>
              </div>
            ) : (
              <>
                <Upload className="w-10 h-10 mx-auto mb-4 text-muted-foreground/40" />
                <p className="text-base font-medium text-foreground mb-1">
                  Arraste o arquivo XML aqui
                </p>
                <p className="text-sm text-muted-foreground mb-5">
                  ou clique para selecionar
                </p>
                <label
                  htmlFor="xml-file-input"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-verde-mata text-white rounded-lg text-sm hover:bg-verde-claro transition-colors cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  Selecionar arquivo .xml
                </label>
              </>
            )}
          </div>
        </>
      )}

      {step === "preview" && preview && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-border p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
                  Nota Fiscal Eletrônica
                </p>
                <p className="font-fraunces text-xl font-bold text-verde-mata">
                  NF-e nº {preview.numeroNf}
                </p>
                <p className="text-sm font-medium text-foreground mt-1.5">
                  {preview.nomeEmitente}
                </p>
                <p className="text-xs text-muted-foreground">
                  CNPJ: {formatCNPJ(preview.cnpjEmitente)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground mb-1">
                  Valor total
                </p>
                <p className="text-2xl font-bold text-verde-mata">
                  {formatBRL(Number(preview.valorTotal))}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {preview.itens.length}{" "}
                  {preview.itens.length === 1 ? "item" : "itens"}
                </p>
              </div>
            </div>
          </div>

          {preview.jaImportada && (
            <div className="flex items-center gap-2.5 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg px-4 py-3 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Esta NF-e já foi importada anteriormente e não pode ser
              importada novamente.
            </div>
          )}

          <div className="flex gap-2.5 flex-wrap">
            {preview.itens.filter((i) => i.produtoId).length > 0 && (
              <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2.5 py-1 rounded-full">
                {preview.itens.filter((i) => i.produtoId).length} produto(s)
                já cadastrado(s)
              </span>
            )}
            {preview.itens.filter((i) => !i.produtoId).length > 0 && (
              <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full">
                {preview.itens.filter((i) => !i.produtoId).length} produto(s)
                novo(s) serão criados
              </span>
            )}
          </div>

          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Produto
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Un.
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                    Qtd
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                    Vlr Unit
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                    Preço Venda
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Categoria
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {preview.itens.map((item, i) => (
                  <tr key={i} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground leading-tight">
                        {item.descricao}
                      </p>
                      {item.produtoId ? (
                        <p className="text-xs text-green-600 mt-0.5">
                          → {item.produtoNome}
                        </p>
                      ) : (
                        <span className="inline-block text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded mt-0.5">
                          Novo produto
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.unidadeNfe}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {Number(item.quantidade).toLocaleString("pt-BR", {
                        maximumFractionDigits: 4,
                      })}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                      {formatBRL(Number(item.valorUnitario))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.produtoId ? (
                        <span className="text-xs text-muted-foreground">
                          mantido
                        </span>
                      ) : (
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={precosVenda[i] ?? ""}
                          onChange={(e) =>
                            setPrecosVenda((prev) => ({
                              ...prev,
                              [i]: e.target.value,
                            }))
                          }
                          className="w-28 px-2 py-1 text-right rounded border border-border text-sm focus:outline-none focus:ring-1 focus:ring-verde-mata focus:border-verde-mata"
                          placeholder="0.00"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {item.produtoId ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <select
                          value={categoriasId[i] ?? ""}
                          onChange={(e) =>
                            setCategoriasId((prev) => ({
                              ...prev,
                              [i]: e.target.value,
                            }))
                          }
                          className="w-36 px-2 py-1 rounded border border-border text-sm focus:outline-none focus:ring-1 focus:ring-verde-mata focus:border-verde-mata bg-white"
                        >
                          <option value="">Sem categoria</option>
                          {categorias.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nome}
                            </option>
                          ))}
                        </select>
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
              disabled={loading || preview.jaImportada}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-verde-mata text-white rounded-lg text-sm font-medium hover:bg-verde-claro transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirmar importação
            </button>
          </div>
        </div>
      )}

      {step === "sucesso" && (
        <div className="bg-white rounded-xl border border-border p-10 text-center">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-7 h-7 text-green-600" />
          </div>
          <h2 className="font-fraunces text-xl font-bold text-foreground mb-2">
            Importação concluída!
          </h2>
          <p className="text-sm text-muted-foreground mb-1">
            Estoque atualizado com sucesso.
          </p>
          <p className="text-sm text-muted-foreground mb-7">
            {resultado.novos > 0 && (
              <span className="text-blue-700 font-medium">
                {resultado.novos} produto(s) criado(s)
              </span>
            )}
            {resultado.novos > 0 && resultado.atualizados > 0 && " · "}
            {resultado.atualizados > 0 && (
              <span className="text-green-700 font-medium">
                {resultado.atualizados} produto(s) com estoque atualizado
              </span>
            )}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={resetar}
              className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted transition-colors"
            >
              Importar outra NF-e
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
