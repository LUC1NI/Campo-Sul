"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { X } from "lucide-react";

const UNIDADES = [
  { value: "UN", label: "Unidade" },
  { value: "KG", label: "Kg" },
  { value: "L", label: "Litro" },
  { value: "SACO", label: "Saco" },
  { value: "CX", label: "Caixa" },
  { value: "M", label: "Metro" },
];

interface Categoria {
  id: string;
  nome: string;
}

interface FiltrosEstoqueProps {
  categorias: Categoria[];
}

export function FiltrosEstoque({ categorias }: FiltrosEstoqueProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("q"); // reset search when filtering
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const q = searchParams.get("q") ?? "";
  const categoria = searchParams.get("categoria") ?? "";
  const unidade = searchParams.get("unidade") ?? "";
  const baixo = searchParams.get("baixo") === "1";
  const fracionavel = searchParams.get("fracionavel") === "1";

  const temFiltros = categoria || unidade || baixo || fracionavel;

  function limparFiltros() {
    router.push(pathname);
  }

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const q = (form.elements.namedItem("q") as HTMLInputElement).value.trim();
    const params = new URLSearchParams(searchParams.toString());
    if (q) params.set("q", q);
    else params.delete("q");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="space-y-3">
      {/* Busca */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nome ou código..."
          className="max-w-sm flex-1 rounded-lg border border-border px-3.5 py-2 text-sm focus:border-verde-mata focus:outline-none focus:ring-2 focus:ring-verde-mata/30"
        />
        <button
          type="submit"
          className="rounded-lg bg-verde-mata px-4 py-2 text-sm text-white transition-colors hover:bg-verde-claro"
        >
          Buscar
        </button>
      </form>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={categoria}
          onChange={(e) => setParam("categoria", e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-verde-mata focus:outline-none focus:ring-2 focus:ring-verde-mata/30"
        >
          <option value="">Todas as categorias</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>

        <select
          value={unidade}
          onChange={(e) => setParam("unidade", e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-verde-mata focus:outline-none focus:ring-2 focus:ring-verde-mata/30"
        >
          <option value="">Todas as unidades</option>
          {UNIDADES.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </select>

        <label className="flex cursor-pointer select-none items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-muted">
          <input
            type="checkbox"
            checked={baixo}
            onChange={(e) => setParam("baixo", e.target.checked ? "1" : "")}
            className="h-3.5 w-3.5 accent-yellow-500"
          />
          Estoque baixo
        </label>

        <label className="flex cursor-pointer select-none items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-muted">
          <input
            type="checkbox"
            checked={fracionavel}
            onChange={(e) => setParam("fracionavel", e.target.checked ? "1" : "")}
            className="h-3.5 w-3.5 accent-terra"
          />
          Fracionável
        </label>

        {temFiltros && (
          <button
            onClick={limparFiltros}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
            Limpar filtros
          </button>
        )}
      </div>
    </div>
  );
}
