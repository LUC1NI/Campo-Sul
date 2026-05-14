import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Unidade } from "@prisma/client";

export interface ItemCarrinho {
  id: string; // único por linha do carrinho — mesmo produto pode ter 2 linhas (inteiro + fracionado)
  produtoId: string;
  nome: string;
  codigo: string;
  unidade: Unidade;
  unidadeEstoque: Unidade;
  precoUnitario: number;
  quantidade: number;
  podeFracionar: boolean;
  pesoUnidade: number | null;
  subtotal: number;
  valorDigitado?: number; // R$ digitado manualmente (ex: "R$ 5,00 → 2,500 kg")
}

export type MetodoPagamento = "DINHEIRO" | "DEBITO" | "CREDITO" | "PIX";

export interface PagamentoCarrinho {
  id: string;
  metodo: MetodoPagamento;
  valor: number;
}

interface CarrinhoState {
  itens: ItemCarrinho[];
  desconto: number; // em reais
  pagamentos: PagamentoCarrinho[];

  // Actions
  adicionarItem: (item: Omit<ItemCarrinho, "id" | "subtotal">) => void;
  removerItem: (id: string) => void;
  atualizarQuantidade: (id: string, quantidade: number) => void;
  atualizarQuantidadePorValor: (id: string, quantidade: number, valorReais: number) => void;
  atualizarPreco: (id: string, preco: number) => void;
  setDesconto: (valor: number) => void;
  adicionarPagamento: (pagamento: PagamentoCarrinho) => void;
  removerPagamento: (id: string) => void;
  limparCarrinho: () => void;

  // Computed (derivados)
  subtotal: () => number;
  total: () => number;
  totalPago: () => number;
  troco: () => number;
}

export const useCarrinho = create<CarrinhoState>()(
  persist(
    (set, get) => ({
      itens: [],
      desconto: 0,
      pagamentos: [],

      adicionarItem: (item) => {
        const id = `${item.produtoId}-${item.unidade}-${Date.now()}`;
        set((state) => {
          // mesma linha (mesmo produto + mesma unidade): soma
          const existente = state.itens.find(
            (i) => i.produtoId === item.produtoId && i.unidade === item.unidade
          );
          if (existente) {
            return {
              itens: state.itens.map((i) =>
                i.id === existente.id
                  ? { ...i, quantidade: i.quantidade + item.quantidade, subtotal: (i.quantidade + item.quantidade) * i.precoUnitario }
                  : i
              ),
            };
          }
          return { itens: [...state.itens, { ...item, id, subtotal: item.quantidade * item.precoUnitario }] };
        });
      },

      removerItem: (id) => {
        set((state) => ({ itens: state.itens.filter((i) => i.id !== id) }));
      },

      atualizarQuantidade: (id, quantidade) => {
        if (quantidade <= 0) {
          get().removerItem(id);
          return;
        }
        set((state) => ({
          itens: state.itens.map((i) =>
            i.id === id ? { ...i, quantidade, subtotal: quantidade * i.precoUnitario, valorDigitado: undefined } : i
          ),
        }));
      },

      atualizarQuantidadePorValor: (id, quantidade, valorReais) => {
        if (quantidade <= 0) {
          get().removerItem(id);
          return;
        }
        set((state) => ({
          itens: state.itens.map((i) =>
            i.id === id ? { ...i, quantidade, subtotal: quantidade * i.precoUnitario, valorDigitado: valorReais } : i
          ),
        }));
      },

      atualizarPreco: (id, preco) => {
        set((state) => ({
          itens: state.itens.map((i) =>
            i.id === id ? { ...i, precoUnitario: preco, subtotal: i.quantidade * preco } : i
          ),
        }));
      },

      setDesconto: (valor) => set({ desconto: Math.max(0, valor) }),

      adicionarPagamento: (pagamento) => {
        set((state) => ({
          pagamentos: state.pagamentos.find((p) => p.id === pagamento.id)
            ? state.pagamentos.map((p) => (p.id === pagamento.id ? pagamento : p))
            : [...state.pagamentos, pagamento],
        }));
      },

      removerPagamento: (id) => {
        set((state) => ({ pagamentos: state.pagamentos.filter((p) => p.id !== id) }));
      },

      limparCarrinho: () => set({ itens: [], desconto: 0, pagamentos: [] }),

      subtotal: () => get().itens.reduce((acc, i) => acc + i.subtotal, 0),
      total: () => Math.max(0, get().subtotal() - get().desconto),
      totalPago: () => get().pagamentos.reduce((acc, p) => acc + p.valor, 0),
      troco: () => Math.max(0, get().totalPago() - get().total()),
    }),
    {
      name: "camposul-carrinho",
    }
  )
);
