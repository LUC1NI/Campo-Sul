"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Unidade } from "@prisma/client";
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
    if (q) params.set("q", q); else params.delete("q");
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
          className="flex-1 max-w-sm px-3.5 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-verde-mata/30 focus:border-verde-mata"
        />
        <button type="submit" className="px-4 py-2 bg-verde-mata text-white rounded-lg text-sm hover:bg-verde-claro transition-colors">
          Buscar
        </button>
      </form>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={categoria}
          onChange={(e) => setParam("categoria", e.target.value)}
          className="px-3 py-2 rounded-lg border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-verde-mata/30 focus:border-verde-mata"
        >
          <option value="">Todas as categorias</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>

        <select
          value={unidade}
          onChange={(e) => setParam("unidade", e.target.value)}
          className="px-3 py-2 rounded-lg border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-verde-mata/30 focus:border-verde-mata"
        >
          <option value="">Todas as unidades</option>
          {UNIDADES.map((u) => (
            <option key={u.value} value={u.value}>{u.label}</option>
          ))}
        </select>

        <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm cursor-pointer hover:bg-muted transition-colors select-none">
          <input
            type="checkbox"
            checked={baixo}
            onChange={(e) => setParam("baixo", e.target.checked ? "1" : "")}
            className="w-3.5 h-3.5 accent-yellow-500"
          />
          Estoque baixo
        </label>

        <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm cursor-pointer hover:bg-muted transition-colors select-none">
          <input
            type="checkbox"
            checked={fracionavel}
            onChange={(e) => setParam("fracionavel", e.target.checked ? "1" : "")}
            className="w-3.5 h-3.5 accent-terra"
          />
          Fracionável
        </label>

        {temFiltros && (
          <button
            onClick={limparFiltros}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Limpar filtros
          </button>
        )}
      </div>
    </div>
  );
}
