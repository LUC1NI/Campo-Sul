"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { Barcode, X } from "lucide-react";
import { LAYOUTS, LAYOUT_PADRAO } from "@/lib/etiquetas-layouts";

interface ItemEtiqueta {
  id: string;
  nome: string;
}

const CHAVE_LAYOUT = "etiqueta-layout";

// Seleção da listagem de estoque — em memória, sobrevive à troca de página/filtro.
const useSelecao = create<{
  itens: Record<string, string>; // id → nome
  alternar: (itens: ItemEtiqueta[], marcar: boolean) => void;
  limpar: () => void;
}>((set) => ({
  itens: {},
  alternar: (itens, marcar) =>
    set((s) => {
      const novo = { ...s.itens };
      for (const i of itens) {
        if (marcar) novo[i.id] = i.nome;
        else delete novo[i.id];
      }
      return { itens: novo };
    }),
  limpar: () => set({ itens: {} }),
}));

export function CheckEtiqueta({ itens, label }: { itens: ItemEtiqueta[]; label: string }) {
  const selecionados = useSelecao((s) => s.itens);
  const alternar = useSelecao((s) => s.alternar);
  const marcado = itens.length > 0 && itens.every((i) => i.id in selecionados);
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={marcado}
      onChange={(e) => alternar(itens, e.target.checked)}
      className="h-4 w-4 cursor-pointer accent-verde-mata"
    />
  );
}

/** Barra flutuante da listagem: aparece quando há produtos marcados. */
export function BarraEtiquetas() {
  const selecionados = useSelecao((s) => s.itens);
  const limpar = useSelecao((s) => s.limpar);
  const [aberto, setAberto] = useState(false);
  const itens = Object.entries(selecionados).map(([id, nome]) => ({ id, nome }));
  if (itens.length === 0) return null;

  return (
    <>
      <div className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-border bg-white px-4 py-2.5 shadow-xl">
        <span className="text-sm text-foreground">
          {itens.length} produto{itens.length !== 1 ? "s" : ""} selecionado{itens.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={() => setAberto(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-verde-mata px-3 py-1.5 text-sm text-white transition-colors hover:bg-verde-claro"
        >
          <Barcode className="h-4 w-4" />
          Imprimir etiquetas
        </button>
        <button onClick={limpar} className="text-sm text-muted-foreground hover:text-foreground">
          Limpar
        </button>
      </div>
      {aberto && <DialogEtiquetas itens={itens} onFechar={() => setAberto(false)} />}
    </>
  );
}

/** Botão da tela de edição de produto. */
export function BotaoEtiqueta({ produto }: { produto: ItemEtiqueta }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-muted"
      >
        <Barcode className="h-4 w-4" />
        Imprimir etiqueta
      </button>
      {aberto && <DialogEtiquetas itens={[produto]} onFechar={() => setAberto(false)} />}
    </>
  );
}

function DialogEtiquetas({ itens, onFechar }: { itens: ItemEtiqueta[]; onFechar: () => void }) {
  // Só monta após clique (nunca no SSR), então dá para ler o localStorage direto.
  const [layout, setLayout] = useState(() => {
    try {
      const salvo = localStorage.getItem(CHAVE_LAYOUT);
      if (salvo && LAYOUTS.some((l) => l.id === salvo)) return salvo;
    } catch {}
    return LAYOUT_PADRAO;
  });
  const [copias, setCopias] = useState<Record<string, string>>({});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onFechar]);

  const qtd = (id: string) => Math.min(500, Math.max(1, Math.floor(Number(copias[id] ?? 1)) || 1));

  function gerar() {
    try {
      localStorage.setItem(CHAVE_LAYOUT, layout);
    } catch {}
    const sp = new URLSearchParams({
      ids: itens.map((i) => i.id).join(","),
      copias: itens.map((i) => qtd(i.id)).join(","),
      layout,
    });
    window.open(`/api/pdf/etiquetas?${sp}`, "_blank");
    onFechar();
  }

  const unico = itens.length === 1;
  const inputCls =
    "rounded-lg border border-border px-3 py-2 text-sm focus:border-verde-mata focus:outline-none focus:ring-2 focus:ring-verde-mata/30";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onFechar} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="etiquetas-titulo"
        className="relative mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-start justify-between">
          <h3 id="etiquetas-titulo" className="font-fraunces text-lg font-bold text-foreground">
            {unico ? "Imprimir etiqueta" : `Imprimir etiquetas (${itens.length} produtos)`}
          </h3>
          <button onClick={onFechar} aria-label="Fechar" className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="mt-4 block text-sm font-medium text-foreground">
          Modelo de etiqueta
          <select value={layout} onChange={(e) => setLayout(e.target.value)} className={`${inputCls} mt-1 w-full bg-white`}>
            {LAYOUTS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome}
              </option>
            ))}
          </select>
        </label>

        {unico ? (
          <label className="mt-4 block text-sm font-medium text-foreground">
            Quantidade de cópias
            <input
              type="number"
              min={1}
              max={500}
              value={copias[itens[0].id] ?? "1"}
              onChange={(e) => setCopias({ [itens[0].id]: e.target.value })}
              className={`${inputCls} mt-1 w-28`}
            />
          </label>
        ) : (
          <div className="mt-4">
            <p className="text-sm font-medium text-foreground">Cópias por produto</p>
            <ul className="mt-1 max-h-64 divide-y divide-border overflow-y-auto rounded-lg border border-border">
              {itens.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="min-w-0 truncate text-sm">{i.nome}</span>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    aria-label={`Cópias de ${i.nome}`}
                    value={copias[i.id] ?? "1"}
                    onChange={(e) => setCopias((c) => ({ ...c, [i.id]: e.target.value }))}
                    className={`${inputCls} w-20 py-1`}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-4 rounded-lg bg-bege/60 px-3 py-2 text-xs text-terra">
          Na hora de imprimir, escolha <strong>tamanho real / 100%</strong> e desmarque{" "}
          <strong>“ajustar à página”</strong> — senão o código de barras sai fora de escala e o leitor pode não ler.
        </p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onFechar}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            onClick={gerar}
            className="rounded-lg bg-verde-mata px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-verde-claro"
          >
            Gerar PDF
          </button>
        </div>
      </div>
    </div>
  );
}
