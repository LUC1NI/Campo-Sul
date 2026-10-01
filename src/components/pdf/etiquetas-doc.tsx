import React from "react";
import path from "path";
import { Document, Page, Text, View, Svg, Rect, Font } from "@react-pdf/renderer";
import { ENTRELINHA, LayoutEtiqueta, linhaMm, medidasEtiqueta, paginaDoLayout } from "@/lib/etiquetas-layouts";

Font.register({
  family: "NotoSans",
  fonts: [
    { src: path.join(process.cwd(), "public", "fonts", "NotoSans-Regular.ttf") },
    { src: path.join(process.cwd(), "public", "fonts", "NotoSans-Bold.ttf"), fontWeight: "bold" },
  ],
});

const pt = (mm: number) => (mm * 72) / 25.4;

export interface EtiquetaPdf {
  nome: string;
  preco: string; // já formatado: "R$ 12,90 / un"
  texto: string; // o que foi codificado
  barras: number[]; // larguras barra/espaço em módulos
  quietZone: number; // módulos
  modulo: number; // mm
}

export function EtiquetasDoc({ layout, etiquetas }: { layout: LayoutEtiqueta; etiquetas: EtiquetaPdf[] }) {
  const pagina = paginaDoLayout(layout);
  const m = medidasEtiqueta(layout);
  const porPagina = pagina.posicoes.length;
  const paginas = Array.from({ length: Math.ceil(etiquetas.length / porPagina) }, (_, i) =>
    etiquetas.slice(i * porPagina, (i + 1) * porPagina)
  );

  return (
    <Document>
      {paginas.map((lote, i) => (
        <Page key={i} size={[pt(pagina.largura), pt(pagina.altura)]} style={{ fontFamily: "NotoSans", color: "#000" }}>
          {lote.map((e, j) => (
            <View
              key={j}
              style={{
                position: "absolute",
                left: pt(pagina.posicoes[j].x),
                top: pt(pagina.posicoes[j].y),
                width: pt(layout.largura),
                height: pt(layout.altura),
                paddingVertical: pt(m.padding),
                alignItems: "center",
              }}
            >
              {/* Altura fixa: as barras ficam na mesma posição com nome curto ou longo. */}
              <View style={{ minHeight: pt(m.linhasNome * linhaMm(m.fontNome)), alignSelf: "stretch", paddingHorizontal: pt(m.padding) }}>
                <Text
                  style={{
                    fontSize: m.fontNome,
                    lineHeight: ENTRELINHA,
                    textAlign: "center",
                    maxLines: m.linhasNome,
                    textOverflow: "ellipsis",
                  }}
                >
                  {e.nome}
                </Text>
              </View>
              <Text style={{ fontSize: m.fontPreco, lineHeight: ENTRELINHA, fontWeight: "bold", marginTop: pt(m.espaco) }}>
                {e.preco}
              </Text>
              <Barras e={e} altura={m.alturaBarras} marginTop={m.espaco} />
              <Text style={{ fontSize: m.fontCodigo, lineHeight: ENTRELINHA, marginTop: pt(m.espaco) }}>{e.texto}</Text>
            </View>
          ))}
        </Page>
      ))}
    </Document>
  );
}

/** Barras vetoriais: largura exata em múltiplos do módulo, quiet zone dos dois lados. */
function Barras({ e, altura, marginTop }: { e: EtiquetaPdf; altura: number; marginTop: number }) {
  const total = e.barras.reduce((s, n) => s + n, 0) + 2 * e.quietZone;
  const rects: React.ReactElement[] = [];
  let x = e.quietZone;
  e.barras.forEach((w, i) => {
    if (i % 2 === 0) rects.push(<Rect key={i} x={pt(x * e.modulo)} y={0} width={pt(w * e.modulo)} height={pt(altura)} fill="#000" />);
    x += w;
  });
  return (
    <Svg width={pt(total * e.modulo)} height={pt(altura)} style={{ marginTop: pt(marginTop) }}>
      {rects}
    </Svg>
  );
}
