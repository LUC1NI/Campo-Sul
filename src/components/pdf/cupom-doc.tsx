import React from "react";
import path from "path";
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";

Font.register({
  family: "NotoSans",
  fonts: [
    { src: path.join(process.cwd(), "public", "fonts", "NotoSans-Regular.ttf") },
    { src: path.join(process.cwd(), "public", "fonts", "NotoSans-Bold.ttf"), fontWeight: "bold" },
  ],
});

// 80mm = 226.77pt · 297mm (A4 height) é suficiente para qualquer cupom
const W = 226.77;

const s = StyleSheet.create({
  page: {
    width: W,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 16,
    fontFamily: "NotoSans",
    fontSize: 8,
    color: "#000",
  },
  center: { textAlign: "center" },
  bold: { fontWeight: "bold" },
  dash: { borderBottom: "0.5px dashed #000", marginVertical: 5 },
  solid: { borderBottom: "0.5px solid #000", marginVertical: 5 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  itemNome: { fontSize: 8, marginBottom: 1 },
  itemDetalhe: { flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: "#333", marginBottom: 4 },
  totalLinha: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  totalGrande: { flexDirection: "row", justifyContent: "space-between", marginTop: 4, marginBottom: 2 },
  pequeno: { fontSize: 7, color: "#555" },
});

interface CupomDocProps {
  numero: number;
  serie: string;
  data: string;
  itens: Array<{
    nomeProduto: string;
    quantidade: string;
    unidadeVenda: string;
    precoUnitario: string;
    total: string;
  }>;
  subtotal: string;
  desconto: string;
  total: string;
  pagamentos: Array<{ metodo: string; valor: string }>;
  empresa: {
    razaoSocial: string;
    cnpj: string;
    endereco: string;
    fone: string;
  };
  tipo: "NOTA" | "RECIBO";
  cpfCnpj?: string | null;
  nomeCliente?: string | null;
}

const METODO_LABEL: Record<string, string> = {
  DINHEIRO: "Dinheiro",
  DEBITO: "Cartão Débito",
  CREDITO: "Cartão Crédito",
  PIX: "PIX",
};

const UNIDADE_LABEL: Record<string, string> = {
  UN: "un", KG: "kg", L: "L", SACO: "sc", CX: "cx", M: "m",
};

export function CupomDoc({
  numero, serie, data, itens, subtotal, desconto, total,
  pagamentos, empresa, tipo, cpfCnpj, nomeCliente,
}: CupomDocProps) {
  return (
    <Document>
      <Page size={[W, 841.89]} style={s.page}>

        {/* Cabeçalho */}
        <Text style={[s.center, s.bold, { fontSize: 10, marginBottom: 2 }]}>
          {empresa.razaoSocial}
        </Text>
        {empresa.cnpj && (
          <Text style={[s.center, s.pequeno]}>CNPJ: {empresa.cnpj}</Text>
        )}
        {empresa.endereco && (
          <Text style={[s.center, s.pequeno]}>{empresa.endereco}</Text>
        )}
        {empresa.fone && (
          <Text style={[s.center, s.pequeno]}>Tel: {empresa.fone}</Text>
        )}

        <View style={s.solid} />

        {/* Tipo e número */}
        <Text style={[s.center, s.bold, { fontSize: 9, marginBottom: 1 }]}>
          {tipo === "NOTA" ? "NOTA FISCAL SIMPLIFICADA" : "RECIBO"}
        </Text>
        <Text style={[s.center, s.pequeno, { marginBottom: 4 }]}>
          Nº {String(numero).padStart(6, "0")} · Série {serie} · {data}
        </Text>

        {/* Cliente */}
        {(nomeCliente || cpfCnpj) && (
          <>
            <View style={s.dash} />
            {nomeCliente && (
              <Text style={[s.pequeno, { marginBottom: 1 }]}>
                <Text style={s.bold}>Cliente: </Text>{nomeCliente}
              </Text>
            )}
            {cpfCnpj && (
              <Text style={s.pequeno}>
                <Text style={s.bold}>CPF/CNPJ: </Text>{cpfCnpj}
              </Text>
            )}
          </>
        )}

        <View style={s.dash} />

        {/* Cabeçalho da tabela */}
        <View style={[s.row, { marginBottom: 3 }]}>
          <Text style={[s.bold, { fontSize: 7 }]}>PRODUTO</Text>
          <Text style={[s.bold, { fontSize: 7 }]}>TOTAL</Text>
        </View>

        {/* Itens */}
        {itens.map((item, i) => (
          <View key={i} style={{ marginBottom: 3 }}>
            <Text style={s.itemNome}>{item.nomeProduto}</Text>
            <View style={s.itemDetalhe}>
              <Text>
                {Number(item.quantidade).toLocaleString("pt-BR", { maximumFractionDigits: 3 })}{" "}
                {UNIDADE_LABEL[item.unidadeVenda] ?? item.unidadeVenda}
                {" × R$ "}
                {Number(item.precoUnitario).toFixed(2).replace(".", ",")}
              </Text>
              <Text style={s.bold}>
                R$ {Number(item.total).toFixed(2).replace(".", ",")}
              </Text>
            </View>
          </View>
        ))}

        <View style={s.dash} />

        {/* Totais */}
        <View style={s.totalLinha}>
          <Text style={s.pequeno}>Subtotal</Text>
          <Text style={s.pequeno}>R$ {Number(subtotal).toFixed(2).replace(".", ",")}</Text>
        </View>
        {Number(desconto) > 0 && (
          <View style={s.totalLinha}>
            <Text style={s.pequeno}>Desconto</Text>
            <Text style={s.pequeno}>- R$ {Number(desconto).toFixed(2).replace(".", ",")}</Text>
          </View>
        )}
        <View style={s.totalGrande}>
          <Text style={[s.bold, { fontSize: 10 }]}>TOTAL</Text>
          <Text style={[s.bold, { fontSize: 10 }]}>
            R$ {Number(total).toFixed(2).replace(".", ",")}
          </Text>
        </View>

        <View style={s.dash} />

        {/* Pagamentos */}
        <Text style={[s.bold, { fontSize: 7.5, marginBottom: 3 }]}>Pagamento</Text>
        {pagamentos.map((p, i) => (
          <View key={i} style={s.totalLinha}>
            <Text style={s.pequeno}>{METODO_LABEL[p.metodo] ?? p.metodo}</Text>
            <Text style={s.pequeno}>R$ {Number(p.valor).toFixed(2).replace(".", ",")}</Text>
          </View>
        ))}

        <View style={s.solid} />

        {/* Rodapé */}
        <Text style={[s.center, s.pequeno, { marginTop: 4 }]}>
          {tipo === "NOTA"
            ? "Documento auxiliar nao fiscal"
            : "Comprovante de pagamento"}
        </Text>
        <Text style={[s.center, s.pequeno]}>Obrigado pela preferencia!</Text>

      </Page>
    </Document>
  );
}
