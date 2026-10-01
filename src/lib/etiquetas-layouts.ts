// Layouts de etiqueta. Puro (sem Node) — usado no diálogo (client) e no PDF (server).
// Todas as medidas em milímetros. Para adicionar um modelo, só preencher as medidas.

export interface LayoutRolo {
  id: string;
  nome: string;
  tipo: "rolo";
  largura: number;
  altura: number;
  /** Resolução da impressora: a largura da barra é arredondada para múltiplos de 1 ponto. */
  dpi: number;
}

export interface LayoutA4 {
  id: string;
  nome: string;
  tipo: "a4";
  largura: number; // da etiqueta
  altura: number;
  margemTopo: number;
  margemEsquerda: number;
  colunas: number;
  linhas: number;
  espacoHorizontal: number; // entre colunas
  espacoVertical: number; // entre linhas
  dpi: number;
}

export type LayoutEtiqueta = LayoutRolo | LayoutA4;

const A4 = { largura: 210, altura: 297 };

export const LAYOUTS: LayoutEtiqueta[] = [
  { id: "rolo-40x25", nome: "Térmica rolo 40 × 25 mm", tipo: "rolo", largura: 40, altura: 25, dpi: 203 },
  { id: "rolo-50x30", nome: "Térmica rolo 50 × 30 mm", tipo: "rolo", largura: 50, altura: 30, dpi: 203 },
  { id: "rolo-60x40", nome: "Térmica rolo 60 × 40 mm", tipo: "rolo", largura: 60, altura: 40, dpi: 203 },
  // Medidas da embalagem Pimaco — conferir com a folha real antes de imprimir um lote.
  {
    id: "a4-pimaco-a4356",
    nome: "Folha A4 Pimaco A4356 (21 por folha, 63,5 × 38,1 mm)",
    tipo: "a4",
    largura: 63.5,
    altura: 38.1,
    margemTopo: 15.15,
    margemEsquerda: 7.25,
    colunas: 3,
    linhas: 7,
    espacoHorizontal: 2.5,
    espacoVertical: 0,
    dpi: 600,
  },
  {
    id: "a4-pimaco-a4351",
    nome: "Folha A4 Pimaco A4351 (65 por folha, 38,2 × 21,2 mm)",
    tipo: "a4",
    largura: 38.2,
    altura: 21.2,
    margemTopo: 10.7,
    margemEsquerda: 4.5,
    colunas: 5,
    linhas: 13,
    espacoHorizontal: 2.5,
    espacoVertical: 0,
    dpi: 600,
  },
];

export const LAYOUT_PADRAO = "rolo-50x30";

export function buscarLayout(id: string): LayoutEtiqueta | undefined {
  return LAYOUTS.find((l) => l.id === id);
}

/** Tamanho da página e canto superior esquerdo de cada etiqueta nela (mm). */
export function paginaDoLayout(l: LayoutEtiqueta) {
  if (l.tipo === "rolo") {
    return { largura: l.largura, altura: l.altura, posicoes: [{ x: 0, y: 0 }] };
  }
  const posicoes: { x: number; y: number }[] = [];
  for (let lin = 0; lin < l.linhas; lin++) {
    for (let col = 0; col < l.colunas; col++) {
      posicoes.push({
        x: l.margemEsquerda + col * (l.largura + l.espacoHorizontal),
        y: l.margemTopo + lin * (l.altura + l.espacoVertical),
      });
    }
  }
  return { ...A4, posicoes };
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const r2 = (v: number) => Math.round(v * 100) / 100;
/** NotoSans precisa de ~1.36em por linha; com menos o react-pdf descarta a linha. */
export const ENTRELINHA = 1.4;
/** Altura de uma linha de texto em mm (fonte em pt). */
export const linhaMm = (pt: number) => (pt * ENTRELINHA * 25.4) / 72;
const ESPACO = 0.6; // mm entre blocos

/** Fontes (pt) e alturas (mm) proporcionais ao tamanho; 50×30 é a escala 1. */
export function medidasEtiqueta(l: LayoutEtiqueta) {
  const s = Math.min(l.largura / 50, l.altura / 30);
  const padding = r2(clamp(1.5 * s, 1, 2.5));
  const fontNome = r2(clamp(7 * s, 5.5, 9));
  const fontPreco = r2(clamp(9.5 * s, 7, 13));
  const fontCodigo = r2(clamp(6.5 * s, 5, 8));
  const linhasNome = l.altura >= 30 ? 2 : 1;
  const sobra =
    l.altura - 2 * padding - linhasNome * linhaMm(fontNome) - linhaMm(fontPreco) - linhaMm(fontCodigo) - 3 * ESPACO;
  return {
    padding,
    fontNome,
    fontPreco,
    fontCodigo,
    linhasNome,
    espaco: ESPACO,
    alturaBarras: r2(Math.min(sobra, 18)),
  };
}

/** Menor barra aceita (mm). 0,19 mm = 2 pontos em 203 dpi; abaixo disso a térmica borra a barra. */
export const MODULO_MINIMO_MM = 0.19;

/**
 * Largura do módulo (barra mais fina) em mm, múltipla de 1 ponto da impressora para
 * não distorcer as barras. `modulos` já inclui as quiet zones. null = não cabe legível.
 */
export function larguraModulo(modulos: number, largura: number, dpi: number): number | null {
  const ponto = 25.4 / dpi;
  // 0,5 mm já é folgado para qualquer leitor; acima disso só desperdiça etiqueta.
  const x = Math.floor(Math.min(largura / modulos, 0.5) / ponto) * ponto;
  return x >= MODULO_MINIMO_MM ? x : null;
}
