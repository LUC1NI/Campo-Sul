import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Unidade } from "@prisma/client";

export interface ItemCarrinho {
  produtoId: string;
  nome: string;
  codigo: string;
  unidade: Unidade; // unidade do item no carrinho (pode ser fracao)
  unidadeEstoque: Unidade;
  precoUnitario: number; // preço por unidade de venda (ex: por kg)
  quantidade: number; // quantidade na unidade de venda
  podeFracionar: boolean;
  pesoUnidade: number | null;
  subtotal: number;
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
  adicionarItem: (item: Omit<ItemCarrinho, "subtotal">) => void;
  removerItem: (produtoId: string) => void;
  atualizarQuantidade: (produtoId: string, quantidade: number) => void;
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
        set((state) => {
          const existente = state.itens.find((i) => i.produtoId === item.produtoId);
          if (existente) {
            return {
              itens: state.itens.map((i) =>
                i.produtoId === item.produtoId
                  ? {
                      ...i,
                      quantidade: i.quantidade + item.quantidade,
                      subtotal: (i.quantidade + item.quantidade) * i.precoUnitario,
                    }
                  : i
              ),
            };
          }
          return {
            itens: [
              ...state.itens,
              { ...item, subtotal: item.quantidade * item.precoUnitario },
            ],
          };
        });
      },

      removerItem: (produtoId) => {
        set((state) => ({ itens: state.itens.filter((i) => i.produtoId !== produtoId) }));
      },

      atualizarQuantidade: (produtoId, quantidade) => {
        if (quantidade <= 0) {
          get().removerItem(produtoId);
          return;
        }
        set((state) => ({
          itens: state.itens.map((i) =>
            i.produtoId === produtoId
              ? { ...i, quantidade, subtotal: quantidade * i.precoUnitario }
              : i
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
