import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatBRL(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(num);
}

// ponytail: offset fixo -03:00 (Brasil sem horário de verão desde 2019).
// Se o horário de verão voltar, trocar por @date-fns/tz com "America/Sao_Paulo".
const OFFSET_SP_MS = -3 * 60 * 60 * 1000;

/** Data "de parede" em Brasília, independente do fuso do servidor (UTC na nuvem). */
function paraHorarioSP(d: Date): Date {
  return new Date(d.getTime() + OFFSET_SP_MS + d.getTimezoneOffset() * 60_000);
}

/** 00:00 de Brasília do dia de `d` (+ deltaDias), como instante UTC para queries. */
export function inicioDoDiaSP(d: Date = new Date(), deltaDias = 0): Date {
  const sp = new Date(d.getTime() + OFFSET_SP_MS);
  return new Date(
    Date.UTC(sp.getUTCFullYear(), sp.getUTCMonth(), sp.getUTCDate() + deltaDias) - OFFSET_SP_MS
  );
}

/** 00:00 de Brasília do dia 1º do mês de `d` (+ deltaMeses). */
export function inicioDoMesSP(d: Date = new Date(), deltaMeses = 0): Date {
  const sp = new Date(d.getTime() + OFFSET_SP_MS);
  return new Date(Date.UTC(sp.getUTCFullYear(), sp.getUTCMonth() + deltaMeses, 1) - OFFSET_SP_MS);
}

/** Dia da semana em Brasília (0 = domingo). */
export function diaDaSemanaSP(d: Date = new Date()): number {
  return new Date(d.getTime() + OFFSET_SP_MS).getUTCDay();
}

export function formatData(date: Date | string, pattern = "dd/MM/yyyy"): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(paraHorarioSP(d), pattern, { locale: ptBR });
}

export function formatDataHora(date: Date | string): string {
  return formatData(date, "dd/MM/yyyy HH:mm");
}

export function formatCNPJ(cnpj: string): string {
  return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

export function formatarQuantidade(qtd: number, unidade: string, podeFracionar: boolean): string {
  if (unidade === "KG" || unidade === "L" || podeFracionar) {
    return qtd.toFixed(3).replace(/\.?0+$/, "").replace(".", ",");
  }
  return Math.round(qtd).toString();
}
