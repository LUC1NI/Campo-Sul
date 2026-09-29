"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X, PackagePlus, Loader2 } from "lucide-react";
import { formatBRL } from "@/lib/format";
import { tokenizarNome } from "@/lib/nfe-correspondencia";
import type { ItemPreview, ProdutoResumo } from "@/app/actions/xml";

export type ProdutoEscolhido = Pick<
  ProdutoResumo,
  "id" | "nome" | "codigo" | "unidade" | "podeFracionar" | "pesoUnidade" | "unidadeFracao" | "quantidade"
> & { precoCusto?: string };

interface Props {
  item: ItemPreview;
  /** "revisar" = popup de sugestões; "buscar" = escolher manualmente qualquer produto */
  modoInicial: "revisar" | "buscar";
  posicao?: { atual: number; total: number };
  onEscolher: (produto: ProdutoEscolhido, origem: "sugestao" | "manual") => void;
  onNovo: () => void;
  onFechar: () => void;
}

/** "COMP" → "cp", "GR" → "g": mesma tabela de unidades do motor de correspondência. */
function unidadeCanonica(palavra: string) {
  const [medida] = tokenizarNome(`1 ${palavra}`).numeros;
  return medida && medida !== "1" ? medida.slice(1) : palavra.toLowerCase();
}

/** Palavras do nome do produto que NÃO aparecem no nome da nota — destacadas para o usuário conferir. */
function NomeComDiferencas({ nome, nota }: { nome: string; nota: string }) {
  const daNota = tokenizarNome(nota).palavras;
  return (
    <>
      {nome.split(/(\s+)/).map((parte, i) => {
        const t = tokenizarNome(parte).palavras[0];
        // "1 KG" separado no cadastro vs "1KG" junto na nota: número bate pelo início, unidade pelo fim
        const bate =
          !t ||
          daNota.some(
            (n) =>
              n === t ||
              (Math.min(n.length, t.length) >= 3 && (n.startsWith(t) || t.startsWith(n))) ||
              (/\d/.test(t) && n.startsWith(t)) ||
              (/^[a-z]+$/.test(t) && /\d/.test(n) && n.endsWith(unidadeCanonica(parte)))
          );
        return bate ? (
          <span key={i}>{parte}</span>
        ) : (
          <mark key={i} className="rounded bg-amber-100 px-0.5 text-amber-900">
            {parte}
          </mark>
        );
      })}
    </>
  );
}

function rotuloSemelhanca(score: number) {
  return score >= 0.8 ? "Muito parecido" : "Parecido";
}

export function DialogCorrespondencia({ item, modoInicial, posicao, onEscolher, onNovo, onFechar }: Props) {
  const [modo, setModo] = useState(item.sugestoes.length ? modoInicial : "buscar");
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<ProdutoEscolhido[]>([]);
  const [buscando, setBuscando] = useState(false);
  const buscaRef = useRef<HTMLInputElement>(null);
  const primeiroRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setModo(item.sugestoes.length ? modoInicial : "buscar");
    setBusca("");
    setResultados([]);
  }, [item, modoInicial]);

  useEffect(() => {
    (modo === "buscar" ? buscaRef : primeiroRef).current?.focus();
  }, [modo, item]);

  // Busca manual (mesma API do PDV) com cancelamento de requisição obsoleta
  useEffect(() => {
    if (modo !== "buscar" || busca.trim().length < 2) {
      setResultados([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setBuscando(true);
      try {
        const r = await fetch(`/api/produtos/buscar?q=${encodeURIComponent(busca.trim())}`, { signal: ctrl.signal });
        if (r.ok) setResultados(await r.json());
      } catch {
        /* abortada */
      } finally {
        if (!ctrl.signal.aborted) setBuscando(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [busca, modo]);

  // Atalhos: 1–3 escolhe sugestão, N = novo, B = buscar, Esc = decidir depois
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onFechar();
      if (modo !== "revisar" || (e.target as HTMLElement).tagName === "INPUT") return;
      const n = Number(e.key);
      if (n >= 1 && n <= item.sugestoes.length) onEscolher(item.sugestoes[n - 1], "sugestao");
      else if (e.key.toLowerCase() === "n") onNovo();
      else if (e.key.toLowerCase() === "b") setModo("buscar");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modo, item, onEscolher, onNovo, onFechar]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onFechar} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-correspondencia"
        className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 pb-4 pt-5">
          <div>
            <h2 id="titulo-correspondencia" className="font-fraunces text-xl font-bold text-verde-mata">
              {modo === "revisar" ? "É o mesmo produto?" : "Vincular a um produto existente"}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {modo === "revisar"
                ? "O nome na nota é parecido com produtos que você já tem. Confira antes de somar ao estoque."
                : "Busque pelo nome ou código do produto no seu cadastro."}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {posicao && posicao.total > 1 && (
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                {posicao.atual} de {posicao.total}
              </span>
            )}
            <button onClick={onFechar} aria-label="Fechar" className="text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          {/* Item da nota */}
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Na nota fiscal</p>
            <p className="mt-1 font-semibold text-foreground">{item.descricao}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {Number(item.quantidade).toLocaleString("pt-BR", { maximumFractionDigits: 4 })} {item.unidadeNfe} ·{" "}
              {formatBRL(Number(item.valorUnitario))} cada
              {item.codigoFornecedor && <> · cód. fornecedor {item.codigoFornecedor}</>}
              {item.gtin && <> · EAN {item.gtin}</>}
            </p>
          </div>

          {modo === "revisar" ? (
            <>
              <p className="mb-2 mt-5 text-sm font-medium text-foreground">Parece com:</p>
              <ul className="space-y-2">
                {item.sugestoes.map((s, i) => (
                  <li key={s.id}>
                    <button
                      ref={i === 0 ? primeiroRef : undefined}
                      onClick={() => onEscolher(s, "sugestao")}
                      className="group flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:border-verde-mata hover:bg-verde-mata/5 focus:border-verde-mata focus:outline-none focus:ring-2 focus:ring-verde-mata/30"
                    >
                      <kbd className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-white text-xs font-semibold text-muted-foreground">
                        {i + 1}
                      </kbd>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-foreground">
                          <NomeComDiferencas nome={s.nome} nota={item.descricao} />
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          Cód. {s.codigo} · estoque {Number(s.quantidade).toLocaleString("pt-BR")} {s.unidade} · custo atual{" "}
                          {formatBRL(Number(s.precoCusto))}
                          {!s.ativo && " · desativado (será reativado)"}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-xs text-muted-foreground">{rotuloSemelhanca(s.score)}</span>
                        <span className="mt-1 inline-block rounded-lg bg-verde-mata px-3 py-1.5 text-xs font-medium text-white group-hover:bg-verde-claro">
                          É este
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                Palavras <mark className="rounded bg-amber-100 px-0.5 text-amber-900">destacadas</mark> não aparecem no nome da nota.
              </p>
            </>
          ) : (
            <div className="mt-5">
              <label htmlFor="busca-produto-nfe" className="text-sm font-medium text-foreground">
                Buscar produto
              </label>
              <div className="relative mt-1.5">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="busca-produto-nfe"
                  ref={buscaRef}
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Digite pelo menos 2 letras"
                  autoComplete="off"
                  className="w-full rounded-lg border border-border py-2.5 pl-9 pr-9 text-sm focus:border-verde-mata focus:outline-none focus:ring-1 focus:ring-verde-mata"
                />
                {buscando && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
              </div>
              <ul className="mt-3 space-y-1.5" aria-live="polite">
                {resultados.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => onEscolher(p, "manual")}
                      className="flex w-full items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 text-left text-sm transition-colors hover:border-verde-mata hover:bg-verde-mata/5 focus:border-verde-mata focus:outline-none"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{p.nome}</span>
                        <span className="text-xs text-muted-foreground">
                          Cód. {p.codigo} · estoque {Number(p.quantidade).toLocaleString("pt-BR")} {p.unidade}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs font-medium text-verde-mata">Escolher</span>
                    </button>
                  </li>
                ))}
                {busca.trim().length >= 2 && !buscando && resultados.length === 0 && (
                  <li className="py-3 text-center text-sm text-muted-foreground">Nenhum produto encontrado.</li>
                )}
              </ul>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/20 px-6 py-4">
          <div className="flex gap-2">
            <button
              onClick={onNovo}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <PackagePlus className="h-4 w-4" />
              {modo === "revisar" ? "Não é nenhum — cadastrar novo" : "Cadastrar como novo"}
              {modo === "revisar" && <kbd className="ml-1 text-xs text-muted-foreground">N</kbd>}
            </button>
            {modo === "revisar" ? (
              <button
                onClick={() => setModo("buscar")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <Search className="h-4 w-4" /> Buscar outro <kbd className="ml-1 text-xs text-muted-foreground">B</kbd>
              </button>
            ) : (
              item.sugestoes.length > 0 && (
                <button
                  onClick={() => setModo("revisar")}
                  className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  ← Ver sugestões
                </button>
              )
            )}
          </div>
          <button onClick={onFechar} className="text-sm text-muted-foreground hover:text-foreground">
            Decidir depois <kbd className="ml-1 text-xs">Esc</kbd>
          </button>
        </div>
      </div>
    </div>
  );
}
