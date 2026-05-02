import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatBRL(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(num);
}

export function formatData(date: Date | string, pattern = "dd/MM/yyyy"): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, pattern, { locale: ptBR });
}

export function formatDataHora(date: Date | string): string {
  return formatData(date, "dd/MM/yyyy HH:mm");
}

export function formatCPF(cpf: string): string {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

export function formatCNPJ(cnpj: string): string {
  return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

export function parseBRL(value: string): number {
  return parseFloat(value.replace(/[^\d,]/g, "").replace(",", ".")) || 0;
}

export function formatarQuantidade(qtd: number, unidade: string, podeFracionar: boolean): string {
  if (unidade === "KG" || unidade === "L" || podeFracionar) {
    return qtd.toFixed(3).replace(/\.?0+$/, "").replace(".", ",");
  }
  return Math.round(qtd).toString();
}
