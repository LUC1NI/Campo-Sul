/**
 * Gera um cupom de teste em /tmp/cupom-teste.pdf
 * Uso: npx tsx scripts/testar-cupom.ts
 */
import path from "path";
import { renderToFile } from "@react-pdf/renderer";
import React from "react";
import { CupomDoc } from "../src/components/pdf/cupom-doc";

const saida = path.join(process.cwd(), "cupom-teste.pdf");

const props = {
  numero: 42,
  serie: "001",
  data: "07/05/2026 14:32",
  itens: [
    { nomeProduto: "Ração Premium Adulto 25kg", quantidade: "2", unidadeVenda: "SACO", precoUnitario: "89.90", total: "179.80" },
    { nomeProduto: "Milho Grão 50kg",           quantidade: "1", unidadeVenda: "SACO", precoUnitario: "62.00", total: "62.00"  },
    { nomeProduto: "Vermífugo Cães 10ml",        quantidade: "3", unidadeVenda: "UN",   precoUnitario: "18.50", total: "55.50"  },
    { nomeProduto: "Sal Mineral Bovino 30kg",    quantidade: "0.500", unidadeVenda: "KG", precoUnitario: "4.20", total: "2.10"  },
  ],
  subtotal: "299.40",
  desconto: "10.00",
  total: "289.40",
  pagamentos: [
    { metodo: "PIX",      valor: "189.40" },
    { metodo: "DINHEIRO", valor: "100.00" },
  ],
  empresa: {
    razaoSocial: "CampoSul Agropecuária Ltda",
    cnpj: "12.345.678/0001-90",
    endereco: "Rua das Acácias, 123 — Centro — Alegrete/RS",
    fone: "(55) 3422-0000",
  },
  tipo: "RECIBO" as const,
  nomeCliente: null,
  cpfCnpj: null,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
renderToFile(React.createElement(CupomDoc as any, props), saida)
  .then(() => console.log("PDF gerado:", saida))
  .catch((err: unknown) => { console.error(err); process.exit(1); });
